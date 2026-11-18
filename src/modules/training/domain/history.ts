import { compareInstants, type ID, type LocalDate } from '@/shared/kernel';
import type { ExerciseSession, WorkoutState } from './types';

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
