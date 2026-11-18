import type { Exercise, PlannedItem } from './types';

// Estimated session duration (RN-PLN-27). Pure: exercises and planned sets come in. `training`
// reuses setSeconds and the constants for the remaining time (RN-TRN-20).

export const WARMUP_SECONDS = 600;
export const SET_WORK_SECONDS = 45;
export const EXERCISE_CHANGE_SECONDS = 90;

const ROUND_TO_MINUTES = 5;

const average = ([min, max]: [number, number]): number => (min + max) / 2;

/** Seconds of one set: work (45 s, or the mean of repRange when metric = 'time') + mean rest. */
export function setSeconds(
  exercise: Pick<Exercise, 'metric' | 'restSeconds'>,
  repRange: [number, number],
): number {
  const work = exercise.metric === 'time' ? average(repRange) : SET_WORK_SECONDS;
  return work + average(exercise.restSeconds);
}

/** Warm-up + Σ (plannedSets × setSeconds + exercise change). Not rounded. */
export function plannedSessionSeconds(items: PlannedItem[]): number {
  return items.reduce(
    (total, item) =>
      total + item.plannedSets * setSeconds(item.exercise, item.repRange) + EXERCISE_CHANGE_SECONDS,
    WARMUP_SECONDS,
  );
}

/** Minutes shown: nearest multiple of 5 (Math.round), at least 5. */
export function displayMinutes(seconds: number): number {
  const minutes = Math.round(seconds / 60 / ROUND_TO_MINUTES) * ROUND_TO_MINUTES;
  return Math.max(ROUND_TO_MINUTES, minutes);
}
