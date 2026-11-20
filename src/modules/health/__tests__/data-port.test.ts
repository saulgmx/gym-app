import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds, type ID, type Instant, type LocalDate } from '@/shared/kernel';
import { createHealth, healthStores } from '..';
import type { HealthBackup, PainEntry } from '../domain/types';

// RN-HLT-21 (contract v1.14, decision 16): the health backup port, through the public API with
// IndexedDB in memory, as health-service.test.ts.

const uuid = (n: number) => `0196a000-0000-7000-8000-${String(n).padStart(12, '0')}` as ID;
const L16 = uuid(100);
const M18 = uuid(102);

const entry = (n: number, workoutId: ID, overrides: Partial<PainEntry> = {}): PainEntry => ({
  id: uuid(n),
  workoutId,
  date: '2026-11-16' as LocalDate,
  recordedAt: '2026-11-16T18:53:00-06:00' as Instant,
  level: 2,
  redFlags: [],
  ...overrides,
});

const spec = (): HealthBackup => ({
  painEntries: [
    entry(500, L16),
    entry(501, M18, { date: '2026-11-18' as LocalDate, level: 5, redFlags: ['numbness'] }),
  ],
});

const opened: Dexie[] = [];

function openDb(): Dexie {
  const db = new Dexie(crypto.randomUUID());
  db.version(1).stores(healthStores);
  opened.push(db);
  return db;
}

afterEach(async () => {
  const names = opened.map((db) => db.name);
  for (const db of opened.splice(0)) db.close();
  await Promise.all(names.map((name) => Dexie.delete(name)));
});

const portOf = (db: Dexie) =>
  createHealth({ db, clock: fixedClock('2026-11-19T22:30:00-06:00'), ids: sequentialIds() })
    .dataPort;

async function stored(data: HealthBackup) {
  const db = openDb();
  await db.table('painEntries').bulkAdd(data.painEntries);
  return { db, port: portOf(db) };
}

const rows = (db: Dexie) => db.table('painEntries').toArray();
const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

function schemaFailure(raw: unknown) {
  const result = portOf(openDb()).validate(raw, 1);
  if (result.ok) throw new Error('expected a schema failure');
  return result.error;
}

describe('RN-HLT-21: el puerto', () => {
  it('se llama health, versión 1, orden 30, con painEntries', () => {
    const port = portOf(openDb());
    expect(port).toMatchObject({ name: 'health', version: 1, order: 30 });
    expect(port.tables).toEqual(['painEntries']);
  });
});

describe('RN-HLT-21: exportData', () => {
  it('(e) todas las entradas tal como están guardadas, por id', async () => {
    const data = spec();
    const { port } = await stored({ painEntries: [...data.painEntries].reverse() });
    expect(await port.exportData()).toStrictEqual(data);
  });

  it('una base vacía da una lista vacía', async () => {
    await expect(portOf(openDb()).exportData()).resolves.toEqual({ painEntries: [] });
  });
});

describe('RN-HLT-21: validate', () => {
  it('lo exportado, pasado por JSON, vuelve igual', async () => {
    const { port } = await stored(spec());
    const exported = await port.exportData();
    expect(port.validate(asJson(exported), 1)).toEqual({ ok: true, value: exported });
  });

  it('(a) acepta las banderas en cualquier orden, y los niveles 0 y 10', () => {
    const data = spec();
    data.painEntries.push(
      entry(502, uuid(103), { level: 0 }),
      entry(503, uuid(104), { level: 10, redFlags: ['bladder_bowel', 'radiating'] }),
    );
    const result = portOf(openDb()).validate(asJson(data), 1);
    expect(result.ok && result.value.painEntries[3]?.redFlags).toEqual([
      'bladder_bowel',
      'radiating',
    ]);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['nivel 11', { level: 11 }, 'painEntries.0.level'],
    ['nivel negativo', { level: -1 }, 'painEntries.0.level'],
    ['nivel decimal', { level: 2.5 }, 'painEntries.0.level'],
    ['bandera desconocida', { redFlags: ['dizziness'] }, 'painEntries.0.redFlags.0'],
    ['bandera repetida', { redFlags: ['numbness', 'numbness'] }, 'painEntries.0.redFlags'],
    ['recordedAt sin offset', { recordedAt: '2026-11-16T18:53:00' }, 'painEntries.0.recordedAt'],
    ['fecha imposible', { date: '2026-02-30' }, 'painEntries.0.date'],
    ['workoutId que no es UUIDv7', { workoutId: 'L16' }, 'painEntries.0.workoutId'],
    ['clave de más', { note: 'x' }, 'painEntries.0'],
  ])('(a) esquema: %s → health/invalid-backup con rule schema y la ruta', (_, patch, path) => {
    const data = spec();
    Object.assign(data.painEntries[0] ?? {}, patch);
    const error = schemaFailure(asJson(data));
    expect(error.code).toBe('health/invalid-backup');
    expect(error.details).toMatchObject({
      rule: 'schema',
      issues: expect.arrayContaining([expect.objectContaining({ path })]) as unknown,
    });
  });

  it('(a) sin painEntries → esquema', () => {
    expect(schemaFailure({}).details).toMatchObject({ rule: 'schema' });
  });

  it('después del esquema aplica las reglas (checkHealthBackup)', () => {
    const data = spec();
    data.painEntries.push(entry(502, M18, { level: 7 }));
    const result = portOf(openDb()).validate(asJson(data), 1);
    expect(!result.ok && result.error.details).toEqual({ rule: 'one-per-workout', workoutId: M18 });
  });

  it('(e) solo acepta fromVersion 1', () => {
    expect(() => portOf(openDb()).validate(asJson(spec()), 2)).toThrow(/RN-HLT-21/);
  });
});

describe('RN-HLT-21: describe y current', () => {
  it('describe es el del dominio', () => {
    expect(portOf(openDb()).describe(spec())).toEqual({
      facts: { painEntries: 2 },
      provides: {},
      requires: { workout: [L16, M18] },
    });
  });

  it('(e) current no aporta nada', async () => {
    const { port } = await stored(spec());
    await expect(port.current()).resolves.toEqual({});
  });
});

describe('RN-HLT-21: importData', () => {
  it('reemplaza la tabla: quedan exactamente las entradas del archivo', async () => {
    const before = spec();
    before.painEntries.push(entry(600, uuid(400), { level: 8 }));
    const { db, port } = await stored(before);
    const file = { painEntries: [entry(501, M18, { level: 3 })] };
    await port.importData(file);
    expect(await rows(db)).toStrictEqual(file.painEntries);
  });

  it('ida y vuelta: exportar → JSON → validar → importar en otra base → exportar da lo mismo', async () => {
    const { port } = await stored(spec());
    const first = await port.exportData();
    const otherPort = portOf(openDb());
    const validated = otherPort.validate(asJson(first), 1);
    if (!validated.ok) throw new Error(validated.error.code);
    await otherPort.importData(validated.value);
    expect(await otherPort.exportData()).toStrictEqual(first);
  });

  it('(e) se anida en una transacción de fuera y, si esta aborta, no queda nada', async () => {
    const { db, port } = await stored(spec());
    const before = await rows(db);
    await expect(
      db.transaction('rw', ['painEntries'], async () => {
        await port.importData({ painEntries: [] });
        throw new Error('a later port failed');
      }),
    ).rejects.toThrow('a later port failed');
    expect(await rows(db)).toStrictEqual(before);
  });

  it('RN-HLT-09: después de importar, el índice único por workout sigue funcionando', async () => {
    const db = openDb();
    const port = portOf(db);
    await port.importData(spec());
    await expect(db.table('painEntries').add(entry(700, L16))).rejects.toThrow();
  });
});
