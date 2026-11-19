import { compareInstants, type Instant } from '@/shared/kernel';
import type { WorkoutState } from './types';

// Summary of a workout for the Cierre and the card of a day already done (RN-TRN-25, spec 005).
// Pure. A WorkoutView fits, since it has `workout` and `sets`.

export interface WorkoutSummary {
  minutes: number;
  setsDone: number; // extra sets included
  itemsWithDoneSets: number;
  itemCount: number;
}

const MINUTE_MS = 60_000;

export function workoutSummary({ workout, sets }: WorkoutState, now: Instant): WorkoutSummary {
  // A closed workout keeps its own end (spec 005 §5); instants are never compared as strings.
  const elapsed = compareInstants(workout.finishedAt ?? now, workout.startedAt);
  const done = sets.filter((s) => s.done);
  return {
    minutes: Math.max(0, Math.floor(elapsed / MINUTE_MS)),
    setsDone: done.length,
    itemsWithDoneSets: workout.items.filter((item) =>
      done.some((s) => s.exerciseId === item.exerciseId),
    ).length,
    itemCount: workout.items.length,
  };
}
