import 'fake-indexeddb/auto';
import Dexie, { type Transaction } from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  err,
  fixedClock,
  ok,
  type DataDescription,
  type DataPort,
  type ID,
  type LocalFacts,
} from '@/shared/kernel';
import { createData } from '..';

// RN-DAT-01 to 05, 09, 10 (contract v1.4, §6 "Detalle del servicio"): data's service over fake
// ports, each with its own table in IndexedDB in memory. The real ports are tested in their
// modules; the round trip with them lives in app (T13).

const clock = fixedClock('2026-11-19T22:30:00-06:00');
const MB10 = 10 * 1024 * 1024;

interface Row {
  id: string;
  ref?: string;
}
interface Rows {
  rows: Row[];
}

const opened: Dexie[] = [];

function openDb(): Dexie {
  const db = new Dexie(crypto.randomUUID());
  db.version(1).stores({ planRows: 'id', trainingRows: 'id', active: 'id', healthRows: 'id' });
  opened.push(db);
  return db;
}

afterEach(async () => {
  vi.restoreAllMocks();
  const names = opened.map((db) => db.name);
  for (const db of opened.splice(0)) db.close();
  await Promise.all(names.map((name) => Dexie.delete(name)));
});

const calls: string[] = [];

// Dexie types currentTransaction as always present; outside a transaction it is null.
function transactionSeen(): { mode: string | undefined; stores: string[] } {
  const tx = Dexie.currentTransaction as Transaction | null;
  return { mode: tx?.mode, stores: tx ? [...tx.storeNames].sort() : [] };
}

/**
 * A port over one table. Its rows provide `kind` ids and require `ref` ids of `needs`.
 * `local` adds a table whose rows mean "a session in progress on this device".
 */
function fakePort(
  db: Dexie,
  opts: {
    name: string;
    order: number;
    table: string;
    kind?: string;
    needs?: string;
    facts?: (rows: Row[]) => DataDescription['facts'];
    local?: boolean;
  },
): DataPort<Rows> {
  const table = db.table<Row, string>(opts.table);
  const active = db.table<Row, string>('active');
  return {
    name: opts.name,
    version: 1,
    order: opts.order,
    tables: opts.local ? [opts.table, 'active'] : [opts.table],
    exportData: async () => ({ rows: await table.toArray() }),
    validate(raw) {
      const rows = (raw as { rows?: unknown } | null)?.rows;
      if (!Array.isArray(rows)) {
        return err({ code: `${opts.name}/invalid`, message: 'no rows', details: { why: 'rows' } });
      }
      return ok({ rows: rows as Row[] });
    },
    describe: ({ rows }) => ({
      facts: opts.facts?.(rows) ?? {},
      provides: opts.kind ? { [opts.kind]: rows.map((r) => r.id as ID) } : {},
      requires: opts.needs
        ? { [opts.needs]: rows.flatMap((r) => (r.ref ? [r.ref as ID] : [])) }
        : {},
    }),
    current: async (): Promise<LocalFacts> =>
      opts.local ? { hasActiveWorkout: (await active.count()) > 0 } : {},
    async importData({ rows }) {
      calls.push(opts.name);
      await table.clear();
      await table.bulkAdd(rows);
    },
  };
}

function setup() {
  calls.length = 0;
  const db = openDb();
  const data = createData({ db, clock });
  const plan = fakePort(db, {
    name: 'plan',
    order: 10,
    table: 'planRows',
    kind: 'exercise',
    facts: () => ({ programStartDate: '2026-11-16' as never }),
  });
  const training = fakePort(db, {
    name: 'training',
    order: 20,
    table: 'trainingRows',
    kind: 'workout',
    needs: 'exercise',
    facts: (rows) => ({ completedWorkouts: rows.length }),
    local: true,
  });
  const health = fakePort(db, {
    name: 'health',
    order: 30,
    table: 'healthRows',
    needs: 'workout',
    facts: (rows) => ({ painEntries: rows.length }),
  });
  // Registered out of order on purpose: they are used by `order`.
  data.registerDataPort(health);
  data.registerDataPort(plan);
  data.registerDataPort(training);
  return { db, data, ports: { plan, training, health } };
}

const fileModules = () => ({
  plan: { version: 1, data: { rows: [{ id: 'ex-1' }, { id: 'ex-2' }] } },
  training: { version: 1, data: { rows: [{ id: 'w-1', ref: 'ex-1' }] } },
  health: { version: 1, data: { rows: [{ id: 'p-1', ref: 'w-1' }] } },
});

const backup = (overrides: Record<string, unknown> = {}) => ({
  app: 'gym-app',
  schemaVersion: 1,
  exportedAt: '2026-11-18T08:00:00-06:00',
  modules: fileModules(),
  ...overrides,
});

const fileOf = (value: unknown) =>
  new File([typeof value === 'string' ? value : JSON.stringify(value)], 'gym-respaldo.json', {
    type: 'application/json',
  });

async function dump(db: Dexie) {
  const names = ['planRows', 'trainingRows', 'healthRows'];
  const rows = await Promise.all(names.map((n) => db.table(n).toArray()));
  return Object.fromEntries(names.map((n, i) => [n, rows[i]]));
}

async function seedDevice(db: Dexie) {
  await db.table('planRows').bulkAdd([{ id: 'old-ex' }]);
  await db.table('trainingRows').bulkAdd([{ id: 'old-w', ref: 'old-ex' }]);
  await db.table('healthRows').bulkAdd([{ id: 'old-p', ref: 'old-w' }]);
}

async function pending(data: ReturnType<typeof createData>, value: unknown = backup()) {
  const result = await data.previewImport(fileOf(value));
  if (!result.ok) throw new Error(`expected a preview, got ${result.error.code}`);
  return result.value;
}

describe('registerDataPort', () => {
  it('RN-DAT-04: un nombre repetido lanza', () => {
    const { db, data } = setup();
    expect(() => {
      data.registerDataPort(fakePort(db, { name: 'plan', order: 99, table: 'planRows' }));
    }).toThrow(/plan/);
  });

  it('RN-DAT-04: un order repetido lanza', () => {
    const { db, data } = setup();
    expect(() => {
      data.registerDataPort(fakePort(db, { name: 'other', order: 20, table: 'planRows' }));
    }).toThrow(/20/);
  });

  it('sin puertos, exportAll y previewImport lanzan (error de composición)', async () => {
    const data = createData({ db: openDb(), clock });
    await expect(data.exportAll()).rejects.toThrow(/port/i);
    await expect(data.previewImport(fileOf(backup()))).rejects.toThrow(/port/i);
  });
});

describe('exportAll', () => {
  it('RN-DAT-09: nombre con la fecha de hoy y tipo application/json', async () => {
    const { data } = setup();
    const { filename, blob } = await data.exportAll();
    expect(filename).toBe('gym-respaldo-2026-11-19.json');
    expect(blob.type).toBe('application/json');
  });

  it('RN-DAT-01, 09: sobre en orden, módulos en orden de order con su versión y sus filas', async () => {
    const { db, data } = setup();
    await seedDevice(db);
    const text = await (await data.exportAll()).blob.text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['app', 'schemaVersion', 'exportedAt', 'modules']);
    expect(parsed).toEqual({
      app: 'gym-app',
      schemaVersion: 1,
      exportedAt: '2026-11-19T22:30:00-06:00',
      modules: {
        plan: { version: 1, data: { rows: [{ id: 'old-ex' }] } },
        training: { version: 1, data: { rows: [{ id: 'old-w', ref: 'old-ex' }] } },
        health: { version: 1, data: { rows: [{ id: 'old-p', ref: 'old-w' }] } },
      },
    });
    expect(Object.keys(parsed.modules as object)).toEqual(['plan', 'training', 'health']);
  });

  it('RN-DAT-09: sangría de 2 espacios y salto de línea al final (AC-12)', async () => {
    const { data } = setup();
    const text = await (await data.exportAll()).blob.text();
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  });

  it('RN-DAT-09: lee todo en una transacción de lectura sobre la unión de las tablas', async () => {
    const { data, ports } = setup();
    const seen: { mode: string | undefined; stores: string[] }[] = [];
    for (const port of Object.values(ports)) {
      const original = port.exportData.bind(port);
      port.exportData = () => {
        seen.push(transactionSeen());
        return original();
      };
    }
    await data.exportAll();
    const union = ['active', 'healthRows', 'planRows', 'trainingRows'];
    expect(seen).toEqual([
      { mode: 'readonly', stores: union },
      { mode: 'readonly', stores: union },
      { mode: 'readonly', stores: union },
    ]);
  });
});

describe('previewImport', () => {
  it('RN-DAT-13: un respaldo válido da la vista previa y valida cada parte con su versión', async () => {
    const { db, data, ports } = setup();
    await seedDevice(db);
    const validate = vi.spyOn(ports.training, 'validate');
    const { preview } = await pending(data);
    expect(validate).toHaveBeenCalledWith(fileModules().training.data, 1);
    expect(preview).toEqual({
      exportedAt: '2026-11-18T08:00:00-06:00',
      schemaVersion: 1,
      completedWorkouts: 1,
      doneSets: 0,
      painEntries: 1,
      dateRange: null,
      hasActiveWorkout: false,
      programStartDate: '2026-11-16',
      currentCompletedWorkouts: 0,
    });
  });

  it('RN-DAT-02: revisar no escribe nada', async () => {
    const { db, data } = setup();
    await seedDevice(db);
    const before = await dump(db);
    await pending(data);
    expect(await dump(db)).toEqual(before);
  });

  it('RN-DAT-02 (paso 1): más de 10 MB → data/file-too-large sin leer el archivo (AC-29)', async () => {
    const { data } = setup();
    const big = new File([new Uint8Array(MB10 + 1)], 'grande.json');
    const text = vi.spyOn(big, 'text');
    const result = await data.previewImport(big);
    expect(!result.ok && result.error.code).toBe('data/file-too-large');
    expect(text).not.toHaveBeenCalled();
  });

  it('RN-DAT-02 (paso 1): exactamente 10 MB pasa el tamaño (y falla después, en el JSON)', async () => {
    const { data } = setup();
    const result = await data.previewImport(new File([' '.repeat(MB10)], 'justo.json'));
    expect(!result.ok && result.error.code).toBe('data/not-gym-app-file');
  });

  it('RN-DAT-02 (pasos 2 a 4): no es JSON, versión más nueva, módulos que no cuadran', async () => {
    const { data } = setup();
    const code = async (value: unknown) => {
      const result = await data.previewImport(fileOf(value));
      return !result.ok && result.error.code;
    };
    expect(await code('no es json')).toBe('data/not-gym-app-file');
    expect(await code(backup({ schemaVersion: 2 }))).toBe('data/unsupported-version');
    const { plan, training } = fileModules();
    const twoModules = { plan, training };
    expect(await code(backup({ modules: twoModules }))).toBe('data/invalid-module-data');
  });

  it('RN-DAT-02 (paso 5): un puerto que rechaza → invalid-module-data con su módulo, su código y sus details', async () => {
    const { data } = setup();
    const modules = { ...fileModules(), training: { version: 1, data: { nope: true } } };
    const result = await data.previewImport(fileOf(backup({ modules })));
    expect(!result.ok && result.error).toMatchObject({
      code: 'data/invalid-module-data',
      details: { module: 'training', cause: 'training/invalid', details: { why: 'rows' } },
    });
  });

  it('RN-DAT-11 (paso 6): una referencia rota → invalid-module-data con data/missing-reference', async () => {
    const { data } = setup();
    const modules = {
      ...fileModules(),
      health: { version: 1, data: { rows: [{ id: 'p-1', ref: 'w-9' }] } },
    };
    const result = await data.previewImport(fileOf(backup({ modules })));
    expect(!result.ok && result.error).toMatchObject({
      code: 'data/invalid-module-data',
      details: {
        module: 'health',
        cause: 'data/missing-reference',
        details: { kind: 'workout', id: 'w-9' },
      },
    });
  });

  it('RN-DAT-05 (paso 7): una sesión en curso en el dispositivo → data/workout-in-progress (AC-33)', async () => {
    const { db, data } = setup();
    await db.table('active').add({ id: 'running' });
    const result = await data.previewImport(fileOf(backup()));
    expect(!result.ok && result.error.code).toBe('data/workout-in-progress');
  });

  it('RN-DAT-02: con un puerto que rechaza y una sesión en curso gana el paso 5', async () => {
    const { db, data } = setup();
    await db.table('active').add({ id: 'running' });
    const modules = { ...fileModules(), plan: { version: 1, data: {} } };
    const result = await data.previewImport(fileOf(backup({ modules })));
    expect(!result.ok && result.error).toMatchObject({ details: { module: 'plan' } });
  });

  it('RN-DAT-02: con un puerto que rechaza después y una referencia rota antes, gana el puerto (paso 5 antes que 6)', async () => {
    const { data } = setup();
    const modules = {
      ...fileModules(),
      training: { version: 1, data: { rows: [{ id: 'w-1', ref: 'ex-9' }] } },
      health: { version: 1, data: {} },
    };
    const result = await data.previewImport(fileOf(backup({ modules })));
    expect(!result.ok && result.error).toMatchObject({ details: { cause: 'health/invalid' } });
  });

  it('un validate que lanza (bug) rechaza la promesa', async () => {
    const { data, ports } = setup();
    vi.spyOn(ports.plan, 'validate').mockImplementation(() => {
      throw new Error('bug in plan');
    });
    await expect(data.previewImport(fileOf(backup()))).rejects.toThrow('bug in plan');
  });
});

describe('commit', () => {
  it('RN-DAT-04, 10: importa en orden de order y deja exactamente lo del archivo (AC-22)', async () => {
    const { db, data } = setup();
    await seedDevice(db);
    const { commit } = await pending(data);
    calls.length = 0;
    expect(await commit()).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual(['plan', 'training', 'health']);
    expect(await dump(db)).toEqual({
      planRows: [{ id: 'ex-1' }, { id: 'ex-2' }],
      trainingRows: [{ id: 'w-1', ref: 'ex-1' }],
      healthRows: [{ id: 'p-1', ref: 'w-1' }],
    });
  });

  it('RN-DAT-10: todo en una transacción rw sobre la unión de las tablas', async () => {
    const { data, ports } = setup();
    const seen: { mode: string | undefined; stores: string[] }[] = [];
    const original = ports.health.importData.bind(ports.health);
    ports.health.importData = (rows) => {
      seen.push(transactionSeen());
      return original(rows);
    };
    await (await pending(data)).commit();
    expect(seen).toEqual([
      { mode: 'readwrite', stores: ['active', 'healthRows', 'planRows', 'trainingRows'] },
    ]);
  });

  it('RN-DAT-03: un puerto que lanza a mitad no deja nada cambiado, tampoco lo del primero (AC-27)', async () => {
    const { db, data, ports } = setup();
    await seedDevice(db);
    const before = await dump(db);
    const { commit } = await pending(data);
    vi.spyOn(ports.health, 'importData').mockImplementation(() =>
      Promise.reject(new Error('health failed')),
    );
    await expect(commit()).rejects.toThrow('health failed');
    expect(await dump(db)).toEqual(before);
  });

  it('RN-DAT-05: una sesión empezada después de la vista previa → workout-in-progress y nada cambia (AC-28)', async () => {
    const { db, data } = setup();
    await seedDevice(db);
    const before = await dump(db);
    const { commit } = await pending(data);
    await db.table('active').add({ id: 'started-meanwhile' });
    const result = await commit();
    expect(!result.ok && result.error.code).toBe('data/workout-in-progress');
    expect(await dump(db)).toEqual(before);
  });

  it('se puede llamar una sola vez: la segunda rechaza, también si la primera no ha terminado', async () => {
    const { data } = setup();
    const { commit } = await pending(data);
    const first = commit();
    await expect(commit()).rejects.toThrow(/once/);
    await expect(first).resolves.toEqual({ ok: true, value: undefined });
    await expect(commit()).rejects.toThrow(/once/);
  });

  it('un commit que falló tampoco se puede repetir', async () => {
    const { db, data } = setup();
    const { commit } = await pending(data);
    await db.table('active').add({ id: 'running' });
    expect((await commit()).ok).toBe(false);
    await db.table('active').clear();
    await expect(commit()).rejects.toThrow(/once/);
  });
});
