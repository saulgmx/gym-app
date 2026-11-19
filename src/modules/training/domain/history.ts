import { compareInstants, type ID, type LocalDate } from '@/shared/kernel';
import type { ExerciseSession, SetLog, WorkoutState } from './types';

// RN-TRN-08: past sessions of one exercise, for "anterior" (RF-12) and the charts (RF-31). Pure.
export function exerciseHistory(
  states: WorkoutState[],
  exerciseId: ID,
  { before, limit }: { before?: LocalDate; limit?: number } = {},
): ExerciseSession[] {
  const sessions = states
    .filter(({ workout }) => workout.status === 'completed')
    .filter(({ workout }) => before === undefined || workout.date < before) // exclusive
    .sort(
      (a, b) =>
        // LocalDate strings sort as dates; Instants never do (ADR-0009).
        b.workout.date.localeCompare(a.workout.date) ||
        compareInstants(b.workout.startedAt, a.workout.startedAt),
    )
    .flatMap(({ workout, sets }): ExerciseSession[] => {
      const done = sets
        .filter((s) => s.exerciseId === exerciseId && s.done)
        .sort((a, b) => a.setNumber - b.setNumber);
      const item = workout.items.find((i) => i.exerciseId === exerciseId);
      if (done.length === 0 || !item) return [];
      return [{ workoutId: workout.id, date: workout.date, repRange: item.repRange, sets: done }];
    });
  return limit === undefined ? sessions : sessions.slice(0, limit);
}

/** One exercise of a session in the history detail (RN-TRN-29, spec 006). */
export interface HistoryItem {
  exerciseId: ID; // the chosen exercise (RN-TRN-13)
  replaces: ID | null; // the main exercise (options[0]) when another one was chosen
  sets: SetLog[]; // done sets of the chosen exercise, by setNumber; [] if none
}

// RN-TRN-29: the detail of a completed session, by item `order` as RN-TRN-17; null otherwise. Pure.
export function historyDetail({ workout, sets }: WorkoutState): HistoryItem[] | null {
  if (workout.status !== 'completed') return null;
  return [...workout.items]
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const main = item.options[0];
      return {
        exerciseId: item.exerciseId,
        replaces: main !== undefined && main !== item.exerciseId ? main : null,
        sets: sets
          .filter((s) => s.exerciseId === item.exerciseId && s.done)
          .sort((a, b) => a.setNumber - b.setNumber),
      };
    });
}
