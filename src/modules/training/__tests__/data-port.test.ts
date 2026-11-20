import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds } from '@/shared/kernel';
import { createTraining, trainingStores } from '..';
import type { TrainingBackup } from '../domain/types';
import { L16, M18, PRENSA, X17, set, specBackup, uuid, workout } from './fixtures/backup';
import { plan } from './fixtures/plan';

// RN-TRN-30 (contract v1.31, decision 33): the training backup port, through the public API
// with IndexedDB in memory, as dexie-repository.test.ts.

const TABLES = ['workouts', 'sets'] as const;
const opened: Dexie[] = [];

function openDb(): Dexie {
  const db = new Dexie(crypto.randomUUID());
  db.version(1).stores(trainingStores);
  opened.push(db);
  return db;
}

afterEach(async () => {
  const names = opened.map((db) => db.name);
  for (const db of opened.splice(0)) db.close();
  await Promise.all(names.map((name) => Dexie.delete(name)));
});

const portOf = (db: Dexie) =>
  createTraining({
    db,
    clock: fixedClock('2026-11-19T22:30:00-06:00'),
    ids: sequentialIds(),
    plan,
    suggestions: { getPrefill: () => Promise.resolve(null) },
    painGate: { hasPainEntry: () => Promise.resolve(true) },
  }).dataPort;

async function stored(data: TrainingBackup) {
  const db = openDb();
  await db.table('workouts').bulkAdd(data.workouts);
  await db.table('sets').bulkAdd(data.sets);
  return { db, port: portOf(db) };
}

async function dump(db: Dexie) {
  const [workouts, sets] = await Promise.all(TABLES.map((t) => db.table(t).toArray()));
  return { workouts, sets };
}

const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const byId = <T extends { id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

function schemaFailure(raw: unknown) {
  const result = portOf(openDb()).validate(raw, 1);
  if (result.ok) throw new Error('expected a schema failure');
  return result.error;
}

describe('RN-TRN-30: el puerto', () => {
  it('se llama training, versión 1, orden 20, con workouts y sets', () => {
    const port = portOf(openDb());
    expect(port).toMatchObject({ name: 'training', version: 1, order: 20 });
    expect([...port.tables].sort()).toEqual(['sets', 'workouts']);
  });
});

describe('RN-TRN-30: exportData', () => {
  it('todas las filas en cualquier estado, tal como están guardadas, por id (decisión 33 (d))', async () => {
    const data = specBackup();
    const shuffled = { workouts: [...data.workouts].reverse(), sets: [...data.sets].reverse() };
    const { port } = await stored(shuffled);
    expect(await port.exportData()).toStrictEqual({
      workouts: byId(data.workouts),
      sets: byId(data.sets),
    });
  });

  it('una base vacía da dos listas vacías', async () => {
    await expect(portOf(openDb()).exportData()).resolves.toEqual({ workouts: [], sets: [] });
  });
});

describe('RN-TRN-30: validate', () => {
  it('lo exportado, pasado por JSON, vuelve igual', async () => {
    const { port } = await stored(specBackup());
    const exported = await port.exportData();
    expect(port.validate(asJson(exported), 1)).toEqual({ ok: true, value: exported });
  });

  it('(a) acepta peso negativo (asistencia), valores null y una sesión en curso', () => {
    const data = specBackup();
    data.workouts.push(workout(uuid(200), { status: 'in_progress' }));
    const assisted = { ...set(L16, PRENSA, 6, true), weightKg: -20 };
    data.sets.push(assisted);
    expect(portOf(openDb()).validate(asJson(data), 1).ok).toBe(true);
  });

  it.each<[string, (d: TrainingBackup) => void, string]>([
    [
      'estado desconocido',
      (d) => Object.assign(d.workouts[0] ?? {}, { status: 'paused' }),
      'workouts.0.status',
    ],
    [
      'peso como texto',
      (d) => Object.assign(d.sets[0] ?? {}, { weightKg: '100' }),
      'sets.0.weightKg',
    ],
    ['reps negativas', (d) => Object.assign(d.sets[0] ?? {}, { reps: -1 }), 'sets.0.reps'],
    ['reps decimales', (d) => Object.assign(d.sets[0] ?? {}, { reps: 2.5 }), 'sets.0.reps'],
    ['RIR negativo', (d) => Object.assign(d.sets[0] ?? {}, { rir: -1 }), 'sets.0.rir'],
    ['setNumber 0', (d) => Object.assign(d.sets[0] ?? {}, { setNumber: 0 }), 'sets.0.setNumber'],
    [
      'rango invertido',
      (d) => Object.assign(d.workouts[0]?.items[0] ?? {}, { repRange: [12, 8] }),
      'workouts.0.items.0.repRange',
    ],
    [
      'clave de más en un workout',
      (d) => Object.assign(d.workouts[0] ?? {}, { extra: 1 }),
      'workouts.0',
    ],
    [
      'clave de más en un ítem',
      (d) => Object.assign(d.workouts[0]?.items[0] ?? {}, { extra: 1 }),
      'workouts.0.items.0',
    ],
    [
      'fecha imposible',
      (d) => Object.assign(d.workouts[0] ?? {}, { date: '2026-02-30' }),
      'workouts.0.date',
    ],
    [
      'instante sin offset',
      (d) => Object.assign(d.workouts[0] ?? {}, { startedAt: '2026-11-16T18:00:00' }),
      'workouts.0.startedAt',
    ],
    ['id que no es UUIDv7', (d) => Object.assign(d.sets[0] ?? {}, { id: 'set-1' }), 'sets.0.id'],
    ['sin sets', (d) => Object.assign(d, { sets: undefined }), 'sets'],
  ])('(a) esquema: %s → training/invalid-backup con rule schema y la ruta', (_, breakIt, path) => {
    const data = specBackup();
    breakIt(data);
    const error = schemaFailure(asJson(data));
    expect(error.code).toBe('training/invalid-backup');
    expect(error.details).toMatchObject({
      rule: 'schema',
      issues: expect.arrayContaining([expect.objectContaining({ path })]) as unknown,
    });
  });

  it('(a) un opcional con undefined explícito no pasa (exactOptional)', () => {
    const data = specBackup();
    const raw = { ...data, workouts: [{ ...data.workouts[0], notes: undefined }] };
    expect(schemaFailure(raw).details).toMatchObject({ rule: 'schema' });
  });

  it('(a) un peso infinito no pasa', () => {
    const data = specBackup();
    Object.assign(data.sets[0] ?? {}, { weightKg: Infinity });
    expect(schemaFailure(data).details).toMatchObject({ rule: 'schema' });
  });

  it('después del esquema aplica las reglas (checkTrainingBackup)', () => {
    const data = specBackup();
    data.workouts.push(workout(L16));
    const result = portOf(openDb()).validate(asJson(data), 1);
    expect(!result.ok && result.error.details).toEqual({ rule: 'unique-workout-id', id: L16 });
  });

  it('(g) solo acepta fromVersion 1', () => {
    const port = portOf(openDb());
    expect(() => port.validate(asJson(specBackup()), 2)).toThrow(/RN-TRN-30/);
  });
});

describe('RN-TRN-30: describe y current', () => {
  it('describe es el del dominio', () => {
    const port = portOf(openDb());
    expect(port.describe(specBackup())).toMatchObject({
      facts: { completedWorkouts: 2, doneSets: 15 },
      provides: { workout: [L16, X17, M18] },
    });
  });

  it('(g) current en una base vacía: 0 y sin sesión en curso', async () => {
    await expect(portOf(openDb()).current()).resolves.toEqual({
      completedWorkouts: 0,
      hasActiveWorkout: false,
    });
  });

  it('(g) current cuenta los completed (no los descartados) y ve la sesión en curso', async () => {
    const data = specBackup();
    data.workouts.push(workout(uuid(200), { status: 'in_progress' }));
    const { port } = await stored(data);
    await expect(port.current()).resolves.toEqual({ completedWorkouts: 2, hasActiveWorkout: true });
  });
});

describe('RN-TRN-30: importData', () => {
  it('reemplaza las dos tablas: quedan exactamente las filas del archivo', async () => {
    const before = specBackup();
    before.workouts.push(workout(uuid(400)));
    before.sets.push(set(uuid(400), PRENSA, 1, true));
    const { db, port } = await stored(before);

    const file = specBackup();
    file.workouts = file.workouts.filter((w) => w.id !== X17);
    file.sets = file.sets.filter((s) => s.workoutId !== X17);
    await port.importData(file);

    expect(await dump(db)).toStrictEqual({ workouts: byId(file.workouts), sets: byId(file.sets) });
  });

  it('ida y vuelta: exportar → JSON → validar → importar en otra base → exportar da lo mismo', async () => {
    const { port } = await stored(specBackup());
    const first = await port.exportData();
    const other = openDb();
    const otherPort = portOf(other);
    const validated = otherPort.validate(asJson(first), 1);
    if (!validated.ok) throw new Error(validated.error.code);
    await otherPort.importData(validated.value);
    expect(await otherPort.exportData()).toStrictEqual(first);
  });

  it('(g) se anida en una transacción de fuera y, si esta aborta, no queda nada', async () => {
    const { db, port } = await stored(specBackup());
    const before = await dump(db);
    await expect(
      db.transaction('rw', [...TABLES], async () => {
        await port.importData({ workouts: [], sets: [] });
        throw new Error('a later port failed');
      }),
    ).rejects.toThrow('a later port failed');
    expect(await dump(db)).toStrictEqual(before);
  });
});
