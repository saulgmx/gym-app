import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import {
  fixedClock,
  sequentialIds,
  type ID,
  type Instant,
  type LocalDate,
  type SeriesRow,
} from '@/shared/kernel';
import { createTraining, trainingStores, type PlanReader } from '..';
import type { Exercise } from '../application/ports';
import type { TrainingBackup } from '../domain/types';
import { DOMINADAS, JALON, PRENSA, X17, set, specBackup, uuid, workout } from './fixtures/backup';

// RN-TRN-31 (spec 008, contract v1.34): the read behind dataPort.seriesRows(), through the public
// API with IndexedDB in memory and a fake plan that records its calls. The rows themselves (order,
// columns, edge cases) are covered by series.test.ts; here, that they come from what is stored,
// cases (c), (i) and (j), and that reading changes nothing (AC-26).

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

const exercise = (id: ID, name: string): Exercise => ({
  id,
  name,
  muscleGroup: 'back',
  equipment: 'machine',
  metric: 'weight',
  lumbarRisk: 'low',
  isPrimary: false,
  restSeconds: [60, 90],
});

const EXERCISES = [
  exercise(PRENSA, 'Prensa de piernas'),
  exercise(DOMINADAS, 'Dominadas'),
  exercise(JALON, 'Jalón al pecho'),
];

/** A plan that answers getExercises from EXERCISES and records every call. */
function countingPlan(getExercises?: PlanReader['getExercises']) {
  const calls: ID[][] = [];
  const plan: PlanReader = {
    getTodayPlan: () => Promise.reject(new Error('not used by seriesRows')),
    getExercises: (ids) => {
      calls.push([...ids]);
      return getExercises
        ? getExercises(ids)
        : Promise.resolve(EXERCISES.filter((e) => ids.includes(e.id)));
    },
  };
  return { plan, calls };
}

function portOf(db: Dexie, plan: PlanReader) {
  return createTraining({
    db,
    clock: fixedClock('2026-11-25T21:00:00-06:00'),
    ids: sequentialIds(),
    plan,
    suggestions: { getPrefill: () => Promise.resolve(null) },
    painGate: { hasPainEntry: () => Promise.resolve(true) },
  }).dataPort;
}

async function stored(data: TrainingBackup, getExercises?: PlanReader['getExercises']) {
  const db = openDb();
  // Stored in reverse, so the rows' order comes from seriesRows and not from the tables.
  await db.table('workouts').bulkAdd([...data.workouts].reverse());
  await db.table('sets').bulkAdd([...data.sets].reverse());
  const { plan, calls } = countingPlan(getExercises);
  return { db, calls, port: portOf(db, plan) };
}

async function dump(db: Dexie) {
  const [workouts, sets] = await Promise.all(
    ['workouts', 'sets'].map((t) => db.table(t).toArray()),
  );
  return { workouts, sets };
}

// The port is optional in DataPort (only training has it); a missing one fails here.
function readRows(port: ReturnType<typeof portOf>): Promise<SeriesRow[]> {
  if (!port.seriesRows) throw new Error('training dataPort has no seriesRows (RN-TRN-31)');
  return port.seriesRows();
}

const day = (s: string) => s as LocalDate;

const sorted = (ids: readonly ID[]) => [...ids].sort();

describe('RN-TRN-31: dataPort.seriesRows() lee lo guardado', () => {
  it('las series hechas de L16 y luego de M18, con el nombre del plan; nada de X17 ni de las no hechas', async () => {
    const { port } = await stored(specBackup());
    const row = (date: string, exercise: string, setNumber: number): SeriesRow => ({
      date: day(date),
      week: 1,
      session: 'Full body A',
      exercise,
      metric: 'weight',
      setNumber,
      weightKg: 100,
      reps: 10,
      rir: 2,
      isExtra: false,
      completedAt: '2026-11-16T18:10:00-06:00' as Instant,
    });
    const rows = (date: string, exercise: string, count: number) =>
      Array.from({ length: count }, (_, i) => row(date, exercise, i + 1));

    expect(await readRows(port)).toStrictEqual([
      ...rows('2026-11-16', 'Prensa de piernas', 5),
      ...rows('2026-11-16', 'Jalón al pecho', 5),
      ...rows('2026-11-18', 'Prensa de piernas', 3),
      ...rows('2026-11-18', 'Jalón al pecho', 2),
    ]);
  });
});

describe('RN-TRN-31 (c), (i): getExercises', () => {
  it('se llama una vez, con los ejercicios de las series que salen y sin repetidos', async () => {
    const data = specBackup();
    // Dominadas is in every item's options and has a done set in a workout still in progress:
    // neither makes it a row, so it is not requested. X17 (discarded) repeats Prensa.
    const active = uuid(200);
    data.workouts.push(workout(active, { date: day('2026-11-25'), status: 'in_progress' }));
    data.sets.push(set(active, DOMINADAS, 1, true));
    const { port, calls } = await stored(data);

    await readRows(port);

    expect(calls).toHaveLength(1);
    // (i) the order of the IDs is not part of the contract.
    expect(sorted(calls[0] ?? [])).toEqual(sorted([PRENSA, JALON]));
  });

  it('una base vacía da [] sin llamar a getExercises', async () => {
    const { port, calls } = await stored({ workouts: [], sets: [] });
    expect(await readRows(port)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('sin series que salgan (descartada, en curso, completed sin hechas) da [] sin llamar', async () => {
    const active = uuid(200);
    const idle = uuid(201);
    const data: TrainingBackup = {
      workouts: [
        workout(X17, { status: 'discarded' }),
        workout(active, { date: day('2026-11-25'), status: 'in_progress' }),
        workout(idle, { date: day('2026-11-19') }),
      ],
      sets: [
        set(X17, PRENSA, 1, true),
        set(active, PRENSA, 1, true),
        set(idle, PRENSA, 1, false),
        set(idle, JALON, 1, false),
      ],
    };
    const { port, calls } = await stored(data);

    expect(await readRows(port)).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe('RN-TRN-31 (j): un rechazo de la lectura llega tal cual', () => {
  it('si getExercises rechaza, seriesRows rechaza con el mismo error', async () => {
    const boom = new Error('plan unavailable');
    const { port } = await stored(specBackup(), () => Promise.reject(boom));
    await expect(readRows(port)).rejects.toBe(boom);
  });

  it('si la lectura de la base falla, rechaza con el error de Dexie y no llama a getExercises', async () => {
    const { db, port, calls } = await stored(specBackup());
    db.close();
    await expect(readRows(port)).rejects.toMatchObject({ name: 'DatabaseClosedError' });
    expect(calls).toEqual([]);
  });
});

describe('RN-TRN-31, AC-26: solo lectura', () => {
  it('la base no cambia', async () => {
    const data = specBackup();
    data.workouts.push(workout(uuid(200), { date: day('2026-11-25'), status: 'in_progress' }));
    const { db, port } = await stored(data);
    const before = await dump(db);

    await readRows(port);

    expect(await dump(db)).toStrictEqual(before);
  });
});
