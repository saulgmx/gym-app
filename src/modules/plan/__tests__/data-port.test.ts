import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { fixedClock, type ID } from '@/shared/kernel';
import { createPlan, planStores } from '..';
import type { PlanSnapshot } from '../domain/schedule';
import { PALLOF, PLANCHA, PRENSA, PROGRAM, uuid, valid, type SeedJson } from './fixtures/seed';

// RN-PLN-29 (contract v1.22, decision 25): the plan's backup port, through the public API with
// IndexedDB in memory, as ensure-seeded.test.ts.

const TABLES = ['exercises', 'programs', 'blocks', 'templates'] as const;
const wednesday = fixedClock('2026-11-18T08:00:00-06:00'); // week 1 starts Monday 2026-11-16

const opened: Dexie[] = [];

function openDb(): Dexie {
  const db = new Dexie(crypto.randomUUID());
  db.version(1).stores(planStores);
  opened.push(db);
  return db;
}

afterEach(async () => {
  const names = opened.map((db) => db.name);
  for (const db of opened.splice(0)) db.close();
  await Promise.all(names.map((name) => Dexie.delete(name)));
});

async function dump(db: Dexie) {
  const rows = await Promise.all(TABLES.map((t) => db.table(t).toArray()));
  return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]]));
}

async function seeded(seed: SeedJson = valid()) {
  const db = openDb();
  const plan = createPlan({ db, clock: wednesday });
  const result = await plan.ensureSeeded(seed);
  if (!result.ok) throw new Error(`fixture seed rejected: ${result.error.code}`);
  return { db, plan, port: plan.dataPort };
}

// The file as JSON carries it: what validate receives.
const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

// A backup as plain JSON, built from the fixture seed, to break one field at a time.
type BackupJson = Omit<SeedJson, 'program'> & {
  program: SeedJson['program'] & { startDate?: unknown };
};
const backupJson = (): BackupJson => {
  const seed = valid();
  return { ...seed, program: { ...seed.program, startDate: '2026-11-16' } };
};

const byId = <T extends { id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

describe('RN-PLN-29: el puerto', () => {
  it('se llama plan, versión 1, orden 10, con sus 4 tablas', () => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    expect(dataPort).toMatchObject({ name: 'plan', version: 1, order: 10 });
    expect([...dataPort.tables].sort()).toEqual([...TABLES].sort());
  });
});

describe('RN-PLN-29: exportData', () => {
  it('da el formato del seed con program.startDate, las filas tal como están guardadas', async () => {
    const { port } = await seeded();
    const seed = valid();
    expect(asJson(await port.exportData())).toEqual({
      exercises: seed.exercises,
      program: { ...seed.program, startDate: '2026-11-16' },
      blocks: seed.blocks,
      templates: seed.templates,
    });
  });

  it('(a) ordena las filas por id y conserva el orden dentro de cada objeto', async () => {
    const seed = valid();
    seed.exercises.reverse();
    seed.templates.reverse();
    const { port } = await seeded(seed);
    const exported = await port.exportData();
    expect(exported.exercises.map((e) => e.id)).toEqual([PRENSA, PLANCHA, PALLOF]);
    expect(exported.templates.map((t) => t.name)).toEqual(['Full body A', 'Full body B']);
    expect(exported.blocks[0]?.schedule.map((e) => e.weekday)).toEqual([1, 1, 2, 3, 4, 5, 6, 0]);
  });

  it('(b) incluye todos los bloques de la tabla, también uno de otro programa', async () => {
    const { db, port } = await seeded();
    const stray = { ...valid().blocks[0], id: uuid(99), programId: uuid(98) };
    await db.table('blocks').add(stray);
    const exported = await port.exportData();
    expect(exported.blocks.map((b) => b.id)).toContain(uuid(99));
  });

  it('(b) sin programa lanza (RN-PLN-22)', async () => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    await expect(dataPort.exportData()).rejects.toThrow(/RN-PLN-22/);
  });

  it('con más de un programa lanza (RN-PLN-25)', async () => {
    const { db, port } = await seeded();
    await db.table('programs').add({ ...backupJson().program, id: uuid(11) });
    await expect(port.exportData()).rejects.toThrow(/RN-PLN-25/);
  });
});

describe('RN-PLN-29: validate', () => {
  it('lo exportado, pasado por JSON, vuelve igual', async () => {
    const { port } = await seeded();
    const exported = await port.exportData();
    expect(port.validate(asJson(exported), 1)).toEqual({ ok: true, value: exported });
  });

  it('(e) startDate puede no ser lunes', () => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    const json = backupJson();
    json.program.startDate = '2026-11-18';
    const result = dataPort.validate(json, 1);
    expect(result.ok && result.value.program.startDate).toBe('2026-11-18');
  });

  it.each([
    ['sin startDate', (j: BackupJson) => delete j.program.startDate, 'program.startDate'],
    [
      'startDate imposible',
      (j: BackupJson) => (j.program.startDate = '2026-02-30'),
      'program.startDate',
    ],
    [
      'clave desconocida en un ejercicio',
      (j: BackupJson) => Object.assign(j.exercises[0] ?? {}, { extra: 1 }),
      'exercises.0',
    ],
    ['sin plantillas', (j: BackupJson) => (j.templates = []), 'templates'],
    ['program como lista', (j: BackupJson) => Object.assign(j, { program: [] }), 'program'],
  ])('esquema: %s → plan/invalid-seed con la ruta', (_, breakIt, path) => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    const json = backupJson();
    breakIt(json);
    const result = dataPort.validate(json, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('plan/invalid-seed');
    expect(result.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })]),
    );
  });

  it('reglas del seed: un bloque que no cubre todas las semanas → plan/invalid-seed (RN-PLN-15 (b))', () => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    const json = backupJson();
    json.program.totalWeeks = 3;
    const result = dataPort.validate(json, 1);
    expect(!result.ok && result.error.code).toBe('plan/invalid-seed');
  });

  it('P-1: un ejercicio high en el catálogo → plan/high-risk-exercise (RN-PLN-07)', () => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    const json = backupJson();
    Object.assign(json.exercises[2] ?? {}, { lumbarRisk: 'high' }); // Pallof, only an alternative
    const result = dataPort.validate(json, 1);
    expect(!result.ok && result.error.code).toBe('plan/high-risk-exercise');
  });

  it('(d) P-1: high gana a otra regla rota (RN-PLN-19)', () => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    const json = backupJson();
    Object.assign(json.exercises[0] ?? {}, { lumbarRisk: 'high' });
    json.program.totalWeeks = 3;
    const result = dataPort.validate(json, 1);
    expect(!result.ok && result.error.code).toBe('plan/high-risk-exercise');
  });

  it('(d) un error de forma va antes que un ejercicio high', () => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    const json = backupJson();
    Object.assign(json.exercises[0] ?? {}, { lumbarRisk: 'high' });
    delete json.program.startDate;
    const result = dataPort.validate(json, 1);
    expect(!result.ok && result.error.code).toBe('plan/invalid-seed');
  });

  it('(c) solo acepta fromVersion 1', () => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    expect(() => dataPort.validate(backupJson(), 2)).toThrow(/RN-PLN-29/);
    expect(() => dataPort.validate(backupJson(), 0)).toThrow(/RN-PLN-29/);
  });
});

describe('RN-PLN-29: describe y current', () => {
  it('(g) ofrece los ejercicios en su orden, no requiere nada y da la fecha de inicio', () => {
    const { dataPort } = createPlan({ db: openDb(), clock: wednesday });
    const result = dataPort.validate(backupJson(), 1);
    if (!result.ok) throw new Error('fixture must validate');
    expect(dataPort.describe(result.value)).toEqual({
      facts: { programStartDate: '2026-11-16' },
      provides: { exercise: [PRENSA, PLANCHA, PALLOF] },
      requires: {},
    });
  });

  it('current no aporta nada', async () => {
    const { port } = await seeded();
    await expect(port.current()).resolves.toEqual({});
  });
});

describe('RN-PLN-29: importData', () => {
  async function importInto(db: Dexie, json: unknown) {
    const { dataPort } = createPlan({ db, clock: wednesday });
    const result = dataPort.validate(json, 1);
    if (!result.ok) throw new Error(`fixture must validate: ${result.error.code}`);
    await dataPort.importData(result.value);
    return result.value;
  }

  it('reemplaza las 4 tablas: quedan exactamente las filas del archivo', async () => {
    const extra = { ...valid().exercises[1], id: uuid(50), name: 'Ejercicio que sobra' };
    const seed = valid();
    seed.exercises.push(extra as SeedJson['exercises'][number]);
    const { db } = await seeded(seed); // 4 exercises in the database

    const json = backupJson();
    json.program.startDate = '2026-12-07';
    Object.assign(json.exercises[0] ?? {}, { name: 'Prensa inclinada' });
    const imported = await importInto(db, json);

    expect(await dump(db)).toEqual({
      exercises: byId(imported.exercises),
      programs: [imported.program],
      blocks: byId(imported.blocks),
      templates: byId(imported.templates),
    });
  });

  it('en una base vacía deja el plan del archivo, y getPosition usa su startDate', async () => {
    const db = openDb();
    const json = backupJson();
    json.program.startDate = '2026-11-09';
    await importInto(db, json);
    const plan = createPlan({ db, clock: wednesday });
    const position = await plan.getPosition('2026-11-18' as never);
    expect(position).toMatchObject({ startDate: '2026-11-09', week: 2 });
  });

  it('ida y vuelta: exportar → importar en otra base → exportar da lo mismo', async () => {
    const { port } = await seeded();
    const first = await port.exportData();
    const other = openDb();
    await importInto(other, asJson(first));
    const second = await createPlan({ db: other, clock: wednesday }).dataPort.exportData();
    expect(second).toStrictEqual(first);
  });

  it('(f) se anida en una transacción rw que ya incluye sus tablas', async () => {
    const { db, port } = await seeded();
    const exported = await port.exportData();
    const renamed: PlanSnapshot = {
      ...exported,
      program: { ...exported.program, name: 'Otro programa' },
    };
    await db.transaction('rw', [...TABLES], () => port.importData(renamed));
    const programs = (await db.table('programs').toArray()) as { id: ID; name: string }[];
    expect(programs).toEqual([expect.objectContaining({ id: PROGRAM, name: 'Otro programa' })]);
  });

  it('(f) si la transacción de fuera aborta, no queda nada del reemplazo', async () => {
    const { db, port } = await seeded();
    const before = await dump(db);
    const exported = await port.exportData();
    const emptyish: PlanSnapshot = { ...exported, exercises: exported.exercises.slice(0, 1) };
    await expect(
      db.transaction('rw', [...TABLES], async () => {
        await port.importData(emptyish);
        throw new Error('a later port failed');
      }),
    ).rejects.toThrow('a later port failed');
    expect(await dump(db)).toEqual(before);
  });
});
