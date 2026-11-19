import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createHealth, healthStores } from '@/modules/health';
import { createPlan, planStores } from '@/modules/plan';
import { createTraining, trainingStores, type SetLog } from '@/modules/training';
import { fixedClock, sequentialIds, type LocalDate } from '@/shared/kernel';
import { openDatabase } from '../db';
import planSeed from '../seed/plan-seed.json';

// RNF-09, P-2: a device on an older version opens the current one without losing data.
// Spec 002 AC-38: version 1 with the plan loaded. Spec 005 AC-46: version 2 with a workout in
// progress; version 3 adds health's painEntries.

const monday = fixedClock('2026-11-16T18:00:00-06:00');
const dump = (db: Dexie, tables: string[]) => Promise.all(tables.map((t) => db.table(t).toArray()));

const opened: Dexie[] = [];

afterEach(async () => {
  const names = new Set(opened.map((db) => db.name));
  for (const db of opened.splice(0)) db.close();
  await Promise.all([...names].map((name) => Dexie.delete(name)));
});

describe('openDatabase', () => {
  it('AC-38: una base v1 con el plan sube a la versión actual sin perder el plan ni startDate', async () => {
    const name = crypto.randomUUID();
    const v1 = new Dexie(name);
    v1.version(1).stores(planStores);
    opened.push(v1);
    const seeded = await createPlan({
      db: v1,
      clock: fixedClock('2026-11-18T08:00:00-06:00'),
    }).ensureSeeded(planSeed);
    expect(seeded.ok).toBe(true);
    const before = await Promise.all(
      Object.keys(planStores).map((table) => v1.table(table).toArray()),
    );
    v1.close();

    const current = openDatabase({ name });
    opened.push(current);
    await current.open();

    expect(current.verno).toBe(3);
    expect(
      await Promise.all(Object.keys(planStores).map((table) => current.table(table).toArray())),
    ).toEqual(before);
    expect((await current.table('programs').toArray())[0]).toMatchObject({
      startDate: '2026-11-16',
    });
    expect(await current.table('workouts').count()).toBe(0);
    expect(await current.table('sets').count()).toBe(0);
    expect(await current.table('painEntries').count()).toBe(0);
  });

  it('AC-46: una base v2 con un workout en curso sube a v3 intacta y acepta el dolor de ese workout', async () => {
    const name = crypto.randomUUID();
    const v2 = new Dexie(name);
    v2.version(1).stores(planStores);
    v2.version(2).stores({ ...planStores, ...trainingStores });
    opened.push(v2);
    const plan = createPlan({ db: v2, clock: monday });
    expect((await plan.ensureSeeded(planSeed)).ok).toBe(true);
    const training = createTraining({
      db: v2,
      clock: monday,
      ids: sequentialIds('t'),
      plan,
      suggestions: { getPrefill: () => Promise.resolve(null) },
    });
    const started = await training.startWorkout('2026-11-16' as LocalDate);
    if (!started.ok) throw new Error(started.error.code);
    const workout = started.value;
    // One set done, so the workout has real data to keep (and could be closed, RN-TRN-22).
    const first = (await v2.table<SetLog>('sets').toArray()).find(
      (s) => s.exerciseId === workout.items[0]?.exerciseId && s.setNumber === 1,
    );
    if (!first) throw new Error('no first set');
    expect((await training.logSet(first.id, { weightKg: 60, reps: 10, rir: 2 })).ok).toBe(true);
    expect((await training.toggleSetDone(first.id)).ok).toBe(true);
    const tables = [...Object.keys(planStores), ...Object.keys(trainingStores)];
    const before = await dump(v2, tables);
    v2.close();

    const v3 = openDatabase({ name });
    opened.push(v3);
    await v3.open();

    expect(v3.verno).toBe(3);
    expect(await dump(v3, tables)).toEqual(before);
    expect(await v3.table('painEntries').count()).toBe(0);
    expect(Object.keys(healthStores)).toEqual(['painEntries']);

    const health = createHealth({ db: v3, clock: monday, ids: sequentialIds('p') });
    const recorded = await health.recordPain(workout.id, {
      level: 2,
      redFlags: [],
      date: workout.date,
    });
    expect(recorded.ok).toBe(true);
    expect(await health.hasPainEntry(workout.id)).toBe(true);
    expect(await v3.table('workouts').get(workout.id)).toMatchObject({ status: 'in_progress' });
  });
});
