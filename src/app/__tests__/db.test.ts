import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlan, planStores } from '@/modules/plan';
import { fixedClock } from '@/shared/kernel';
import { openDatabase } from '../db';
import planSeed from '../seed/plan-seed.json';

// Spec 002 AC-38 (RNF-09): the iPhone has a version 1 database with the plan loaded; opening the
// new version adds training's tables without touching the plan.

const opened: Dexie[] = [];

afterEach(async () => {
  const names = new Set(opened.map((db) => db.name));
  for (const db of opened.splice(0)) db.close();
  await Promise.all([...names].map((name) => Dexie.delete(name)));
});

describe('openDatabase', () => {
  it('AC-38: una base v1 con el plan sube a v2 sin perder el plan ni startDate', async () => {
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

    const v2 = openDatabase({ name });
    opened.push(v2);
    await v2.open();

    expect(v2.verno).toBe(2);
    expect(
      await Promise.all(Object.keys(planStores).map((table) => v2.table(table).toArray())),
    ).toEqual(before);
    expect((await v2.table('programs').toArray())[0]).toMatchObject({ startDate: '2026-11-16' });
    expect(await v2.table('workouts').count()).toBe(0);
    expect(await v2.table('sets').count()).toBe(0);
  });
});
