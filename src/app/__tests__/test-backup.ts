import type { Dexie } from 'dexie';
import { fixedClock, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import { createTestServices, lastTestDatabase } from './test-app';
import { closeSession, markSets, setup } from './test-sessions';

// Devices for the backup tests (spec 007 §4, T13 and T17), written through the API.

const date = (s: string) => s as LocalDate;

/** Spec 007 §4: L16 complete, a session discarded on the 17th, M18 partial for the Friday. */
export async function deviceWithSpecData() {
  const env = await setup();
  await closeSession(env, { on: '2026-11-16', allSets: true, level: 2, end: '18:52' });

  env.time.set('2026-11-17T18:00:00-06:00');
  const tuesday = await env.services.training.startWorkout(date('2026-11-17'), {
    plannedFor: date('2026-11-18'), // Tuesday is cardio: another session of the week (RN-TRN-14)
  });
  if (!tuesday.ok) throw new Error(tuesday.error.code);
  await markSets(env.services, tuesday.value, 2);
  const discarded = await env.services.training.discardWorkout(tuesday.value.id);
  if (!discarded.ok) throw new Error(discarded.error.code);

  await closeSession(env, {
    on: '2026-11-18',
    plannedFor: '2026-11-20',
    sets: 5,
    level: 5,
    redFlags: ['numbness'],
    end: '18:30',
  });
  return { services: env.services, time: env.time, db: lastTestDatabase() };
}

/** A device seeded on another week, as a new phone would be. */
export async function freshDevice(seedOn = '2026-12-02T09:00:00-06:00') {
  const services = createTestServices({ seedClock: fixedClock(seedOn) });
  await services.ready;
  return { services, db: lastTestDatabase() };
}

export async function exportText(services: AppServices) {
  const { blob } = await services.data.exportAll();
  return blob.text();
}

const TABLES = [
  'exercises',
  'programs',
  'blocks',
  'templates',
  'workouts',
  'sets',
  'painEntries',
] as const;

/** Every table of the backup, rows sorted by id: two dumps compare deeply (AC-26). */
export async function dump(db: Dexie) {
  const rows = await Promise.all(
    TABLES.map(async (t) => {
      const all = (await db.table(t).toArray()) as { id: string }[];
      return all.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }),
  );
  return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]]));
}
