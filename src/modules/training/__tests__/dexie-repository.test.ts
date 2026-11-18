import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixedClock, sequentialIds, type ID, type Instant, type LocalDate } from '@/shared/kernel';
import { createTraining, trainingStores } from '..';
import type { Exercise, PlanReader, TodayPlan } from '../application/ports';
import type { SetLog, Workout } from '../domain/types';

// Integration through the public API with IndexedDB in memory (AC-2, AC-4, AC-12, RN-TRN-03,
// RN-TRN-18, QS-03). Each test opens its own database, as app/db.ts will (plan §4).

const date = (s: string) => s as LocalDate;
const id = (s: string) => s as ID;
const saturday = fixedClock('2026-11-21T09:30:00-06:00');

const exercise = (key: string, overrides: Partial<Exercise> = {}): Exercise => ({
  id: id(key),
  name: key,
  muscleGroup: 'quads',
  equipment: 'machine',
  metric: 'weight',
  lumbarRisk: 'low',
  isPrimary: false,
  restSeconds: [60, 90],
  ...overrides,
});
const prensa = exercise('prensa');
const dominadas = exercise('dominadas', { muscleGroup: 'back', equipment: 'bodyweight' });
const jalon = exercise('jalon', { muscleGroup: 'back', equipment: 'cable' });

// Saturday 2026-11-21 is a workout day with Prensa (2 of 3 sets) and Dominadas or Jalón (1 of 2).
const workoutDay: TodayPlan = {
  kind: 'workout',
  position: {
    status: 'active',
    startDate: date('2026-11-16'),
    totalWeeks: 15,
    week: 1,
    block: null,
    isDeloadWeek: false,
    volumeFactor: 0.7,
  },
  template: {
    id: id('tpl-a'),
    blockId: id('block-1'),
    name: 'Full body A',
    items: [
      { exerciseId: prensa.id, order: 1, sets: [3, 3], reps: [8, 12] },
      { exerciseId: dominadas.id, alternatives: [jalon.id], order: 2, sets: [2, 2], reps: [6, 10] },
    ],
  },
  plannedItems: [
    {
      exercise: prensa,
      alternatives: [],
      order: 1,
      plannedSets: 2,
      repRange: [8, 12],
      targetRir: [3, 4],
    },
    {
      exercise: dominadas,
      alternatives: [jalon],
      order: 2,
      plannedSets: 1,
      repRange: [6, 10],
      targetRir: [3, 4],
    },
  ],
};

const plan: PlanReader = {
  getTodayPlan: () => Promise.resolve(workoutDay),
  getExercises: (ids) =>
    Promise.resolve([prensa, dominadas, jalon].filter((e) => ids.includes(e.id))),
};
const noSuggestions = { getPrefill: () => Promise.resolve(null) };

const opened: Dexie[] = [];

function openDb(name: string = crypto.randomUUID()): Dexie {
  const db = new Dexie(name);
  db.version(1).stores(trainingStores);
  opened.push(db);
  return db;
}

afterEach(async () => {
  vi.restoreAllMocks();
  const names = new Set(opened.map((db) => db.name));
  for (const db of opened.splice(0)) db.close();
  await Promise.all([...names].map((name) => Dexie.delete(name)));
});

// Each instance gets its own ID prefix, as two devices or tabs would.
const training = (db: Dexie, prefix = 'id') =>
  createTraining({
    db,
    clock: saturday,
    ids: sequentialIds(prefix),
    plan,
    suggestions: noSuggestions,
  });

const ok = <T>(result: { ok: true; value: T } | { ok: false; error: { code: string } }) => {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}`);
  return result.value;
};

async function dump(db: Dexie) {
  const [workouts, sets] = await Promise.all([
    db.table<Workout>('workouts').toArray(),
    db.table<SetLog>('sets').toArray(),
  ]);
  return { workouts, sets };
}

async function setsOf(db: Dexie, exerciseId: string) {
  const sets = await db.table<SetLog>('sets').where('exerciseId').equals(exerciseId).toArray();
  return sets.sort((a, b) => a.setNumber - b.setNumber);
}

async function firstSet(db: Dexie, exerciseId: string, n = 1) {
  const found = (await setsOf(db, exerciseId)).find((s) => s.setNumber === n);
  if (!found) throw new Error(`${exerciseId} ${String(n)}`);
  return found.id;
}

describe('startWorkout', () => {
  it('AC-2: dos startWorkout a la vez desde dos conexiones dejan una sola sesión activa', async () => {
    const name = crypto.randomUUID();
    const [a, b] = [training(openDb(name), 'a'), training(openDb(name), 'b')];

    const results = await Promise.all([
      a.startWorkout(date('2026-11-21')),
      b.startWorkout(date('2026-11-21')),
    ]);

    const created = results.filter((r) => r.ok);
    const rejected = results.filter((r) => !r.ok);
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const winner = ok(created[0] ?? rejected[0] ?? results[0]);
    expect(rejected[0]).toMatchObject({
      error: { code: 'training/workout-already-active', details: { workoutId: winner.id } },
    });
    const { workouts, sets } = await dump(openDb(name));
    expect(workouts.map((w) => w.id)).toEqual([winner.id]);
    expect(sets).toHaveLength(3);
  });

  it('guarda el workout y sus series tal cual (objetos del dominio)', async () => {
    const db = openDb();
    const workout = ok(await training(db).startWorkout(date('2026-11-21')));
    const { workouts, sets } = await dump(db);
    expect(workouts).toEqual([workout]);
    expect(sets.map((s) => [s.exerciseId, s.setNumber, s.workoutId])).toEqual(
      expect.arrayContaining([
        ['prensa', 1, workout.id],
        ['prensa', 2, workout.id],
        ['dominadas', 1, workout.id],
      ]) as unknown,
    );
  });
});

describe('recuperar la sesión', () => {
  it('AC-4, QS-03: iniciar, registrar 3 series y abrir otra instancia → todo sigue', async () => {
    const name = crypto.randomUUID();
    const db = openDb(name);
    const service = training(db);
    const workout = ok(await service.startWorkout(date('2026-11-21')));
    for (const [exerciseId, n, values] of [
      ['prensa', 1, { weightKg: 60, reps: 10 }],
      ['prensa', 2, { reps: 9 }],
      ['dominadas', 1, { weightKg: -20, reps: 7 }],
    ] as const) {
      const setId = await firstSet(db, exerciseId, n);
      ok(await service.logSet(setId, values));
      ok(await service.toggleSetDone(setId));
    }
    db.close();

    const reopened = training(openDb(name), 'other');

    expect(await reopened.getActiveWorkout()).toEqual(workout);
    const view = await reopened.getWorkoutView(workout.id);
    expect(view?.sets.map((s) => [s.exerciseId, s.setNumber, s.weightKg, s.reps, s.done])).toEqual([
      ['prensa', 1, 60, 10, true],
      ['prensa', 2, 60, 9, true],
      ['dominadas', 1, -20, 7, true],
    ]);
  });
});

describe('escrituras', () => {
  it('RN-TRN-03: logSet escribe antes de devolver (AC-12)', async () => {
    const db = openDb();
    const service = training(db);
    ok(await service.startWorkout(date('2026-11-21')));
    const setId = await firstSet(db, 'prensa');

    ok(await service.logSet(setId, { weightKg: 60 }));

    expect((await db.table<SetLog>('sets').get(setId))?.weightKg).toBe(60);
  });

  it('RN-TRN-11: marcar y heredar el peso se escriben juntos', async () => {
    const db = openDb();
    const service = training(db);
    ok(await service.startWorkout(date('2026-11-21')));
    const setId = await firstSet(db, 'prensa');
    ok(await service.logSet(setId, { weightKg: 60, reps: 10 }));

    ok(await service.toggleSetDone(setId));

    expect((await setsOf(db, 'prensa')).map((s) => [s.done, s.weightKg])).toEqual([
      [true, 60],
      [false, 60],
    ]);
  });

  it('un error del dominio no escribe nada', async () => {
    const db = openDb();
    const service = training(db);
    ok(await service.startWorkout(date('2026-11-21')));
    const setId = await firstSet(db, 'prensa');
    const before = await dump(db);

    expect((await service.logSet(setId, { weightKg: 60.1 })).ok).toBe(false);
    expect((await service.toggleSetDone(setId)).ok).toBe(false);

    expect(await dump(db)).toEqual(before);
  });

  it('RN-TRN-13: elegir la alternativa cambia el workout y sus series en una transacción', async () => {
    const db = openDb();
    const service = training(db);
    const workout = ok(await service.startWorkout(date('2026-11-21')));

    ok(await service.chooseExercise(workout.id, dominadas.id, jalon.id));

    const { workouts } = await dump(db);
    expect(workouts[0]?.items[1]?.exerciseId).toBe('jalon');
    expect(await setsOf(db, 'dominadas')).toEqual([]);
    expect(await setsOf(db, 'jalon')).toHaveLength(1);
  });

  it('RN-TRN-10: quitar una serie la borra y renumera las siguientes', async () => {
    const db = openDb();
    const service = training(db);
    const workout = ok(await service.startWorkout(date('2026-11-21')));
    const extra = ok(await service.addExtraSet(workout.id, prensa.id));

    ok(await service.removeSet(await firstSet(db, 'prensa', 2)));

    expect((await setsOf(db, 'prensa')).map((s) => [s.setNumber, s.isExtra])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect((await db.table<SetLog>('sets').get(extra.id))?.setNumber).toBe(2);
  });

  it('RN-TRN-15: descartar se guarda y deja iniciar otra', async () => {
    const db = openDb();
    const service = training(db);
    const workout = ok(await service.startWorkout(date('2026-11-21')));

    ok(await service.discardWorkout(workout.id));

    expect((await dump(db)).workouts[0]?.status).toBe('discarded');
    expect(await service.getActiveWorkout()).toBeUndefined();
    expect((await service.startWorkout(date('2026-11-21'))).ok).toBe(true);
  });

  it('RN-TRN-18: si la base falla a mitad de un cambio, rechaza y no queda nada a medias', async () => {
    const db = openDb();
    const service = training(db);
    ok(await service.startWorkout(date('2026-11-21')));
    const [first, second] = [await firstSet(db, 'prensa', 1), await firstSet(db, 'prensa', 2)];
    ok(await service.logSet(first, { weightKg: 60, reps: 10 }));
    const before = await dump(db);
    // The inherited weight (RN-TRN-11) is the second write of the transaction: make it fail.
    db.table('sets').hook('updating', (_mods, key) => {
      if (key === second) throw new Error('disk failure');
    });

    await expect(service.toggleSetDone(first)).rejects.toThrow(/disk failure/);

    expect(await dump(db)).toEqual(before);
  });
});

describe('getExerciseHistory', () => {
  it('RN-TRN-08: encuentra las sesiones completadas del ejercicio en la base', async () => {
    const db = openDb();
    const service = training(db);
    const workout = ok(await service.startWorkout(date('2026-11-21')));
    const setId = await firstSet(db, 'prensa');
    ok(await service.logSet(setId, { weightKg: 60, reps: 10 }));
    ok(await service.toggleSetDone(setId));
    // Phase 2 cannot close a session; the test closes it in storage (phase 3 does it for real).
    await db.table<Workout>('workouts').update(workout.id, {
      status: 'completed',
      finishedAt: '2026-11-21T10:30:00-06:00' as Instant,
    });

    const [session] = await service.getExerciseHistory(prensa.id);

    expect(session).toMatchObject({ workoutId: workout.id, date: '2026-11-21', repRange: [8, 12] });
    expect(session?.sets.map((s) => s.id)).toEqual([setId]);
    expect(await service.getExerciseHistory(jalon.id)).toEqual([]);
  });
});
