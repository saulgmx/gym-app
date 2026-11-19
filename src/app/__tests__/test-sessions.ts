import type { RedFlag } from '@/modules/health';
import type { Workout } from '@/modules/training';
import { fixedClock, type Clock, type Instant, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import { createTestServices } from './test-app';

// Closed sessions written through the API, as the app writes them (spec 005 plan §7, spec 006
// plan §7). Training and health share a clock the test moves, so each session has its own start
// and end and each pain entry its own recordedAt. Pages read a fixed clock at `page`.

const date = (s: string) => s as LocalDate;

export function movableClock(start: string) {
  let now = start;
  const clock: Clock = { now: () => now as Instant, today: () => now.slice(0, 10) as LocalDate };
  return {
    clock,
    set: (instant: string) => {
      now = instant;
    },
  };
}

/** Services where "Hoy" opens at `page`; training and health use the movable clock. */
export async function setup(page = '2026-11-18T08:00:00-06:00') {
  const time = movableClock('2026-11-16T08:00:00-06:00');
  const services = createTestServices({ clock: fixedClock(page), seedClock: time.clock });
  await services.ready;
  return { services, time };
}

/** Marks every planned set of a workout, only the first one, or the first `n` in session order. */
export async function markSets(services: AppServices, workout: Workout, all: boolean | number) {
  const view = await services.training.getWorkoutView(workout.id);
  if (!view) throw new Error('no view');
  const count = all === true ? view.sets.length : all === false ? 1 : all;
  const sets = view.sets.slice(0, count);
  for (const set of sets) {
    const metric = view.exercises[set.exerciseId]?.metric;
    await services.training.logSet(
      set.id,
      metric === 'weight' ? { weightKg: 40, reps: 10, rir: 3 } : { reps: 30, rir: 3 },
    );
    const marked = await services.training.toggleSetDone(set.id);
    if (!marked.ok) throw new Error(marked.error.code);
  }
}

/** Starts, logs, records pain and closes a session, as the Cierre does. */
export async function closeSession(
  { services, time }: Awaited<ReturnType<typeof setup>>,
  opts: {
    on: string; // the day it is done
    plannedFor?: string;
    start?: string; // HH:MM
    end?: string;
    level?: number;
    redFlags?: RedFlag[];
    allSets?: boolean;
    sets?: number; // the first n sets in session order, instead of allSets
  },
) {
  time.set(`${opts.on}T${opts.start ?? '18:00'}:00-06:00`);
  const started = await services.training.startWorkout(date(opts.on), {
    plannedFor: date(opts.plannedFor ?? opts.on),
  });
  if (!started.ok) throw new Error(started.error.code);
  await markSets(services, started.value, opts.sets ?? opts.allSets ?? false);
  time.set(`${opts.on}T${opts.end ?? '18:52'}:00-06:00`);
  const recorded = await services.health.recordPain(started.value.id, {
    level: opts.level ?? 1,
    redFlags: opts.redFlags ?? [],
    date: started.value.date,
  });
  if (!recorded.ok) throw new Error(recorded.error.code);
  const finished = await services.training.finishWorkout(started.value.id, {});
  if (!finished.ok) throw new Error(finished.error.code);
  return finished.value;
}
