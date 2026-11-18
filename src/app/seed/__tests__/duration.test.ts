import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPlan,
  displayMinutes,
  planStores,
  plannedSessionSeconds,
  type PlanApi,
} from '@/modules/plan';
import { fixedClock, type LocalDate } from '@/shared/kernel';
import planSeed from '../plan-seed.json';

// RN-PLN-27 on the real seed (spec 003 AC-1, AC-5, AC-6). Loaded on Wednesday 2026-11-18, so the
// program starts on Monday 2026-11-16. Expected values computed with Node from plan-seed.json.

const date = (s: string) => s as LocalDate;

let db: Dexie;
let plan: PlanApi;

beforeAll(async () => {
  db = new Dexie(crypto.randomUUID());
  db.version(1).stores(planStores);
  plan = createPlan({ db, clock: fixedClock('2026-11-18T08:00:00-06:00') });
  await plan.ensureSeeded(planSeed);
});

afterAll(async () => {
  db.close();
  await Dexie.delete(db.name);
});

async function sessionOn(day: string) {
  const today = await plan.getTodayPlan(date(day));
  if (today.kind !== 'workout') throw new Error(`${day} is not a workout day`);
  return {
    name: today.template.name,
    seconds: plannedSessionSeconds(today.plannedItems),
    minutes: displayMinutes(plannedSessionSeconds(today.plannedItems)),
  };
}

describe('duración con el seed real (RN-PLN-27)', () => {
  it('AC-1: Full body A de la semana 1 (lunes 16-nov) → 50 min', async () => {
    expect(await sessionOn('2026-11-16')).toEqual({
      name: 'Full body A',
      seconds: 2880,
      minutes: 50,
    });
  });

  it('AC-6: Full body B de la semana 1 (miércoles 18-nov) → 55 min', async () => {
    expect(await sessionOn('2026-11-18')).toEqual({
      name: 'Full body B',
      seconds: 3270,
      minutes: 55,
    });
  });

  it('AC-6: Full body B de la semana 2 (lunes 23-nov, factor 1) → 75 min', async () => {
    expect(await sessionOn('2026-11-23')).toEqual({
      name: 'Full body B',
      seconds: 4485,
      minutes: 75,
    });
  });

  it('AC-5: en el deload (lunes 22-feb-2027, Push) usa el 50% de las series', async () => {
    // Push al 100% serían 4530 s (75 min); al 50% son 3390 s.
    expect(await sessionOn('2027-02-22')).toEqual({ name: 'Push', seconds: 3390, minutes: 55 });
  });
});
