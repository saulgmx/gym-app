import { compareInstants, type SeriesRow } from '@/shared/kernel';
import type { SeriesExercise, WorkoutState } from './types';

// RN-TRN-31 (spec 008): one row of the series CSV per done set of each completed workout, by
// date, then startedAt as an instant (ADR-0009), then id, then the item order and setNumber.
// Only the rows that come out are checked; broken data among them throws (cases (b) and (g)).
// Pure: it sorts copies and never modifies its input (case (h)).
export function seriesRows(
  states: readonly WorkoutState[],
  exercises: readonly SeriesExercise[],
): SeriesRow[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return states
    .filter(({ workout }) => workout.status === 'completed')
    .sort(
      (a, b) =>
        // LocalDate strings sort as dates; Instants never do (ADR-0009).
        a.workout.date.localeCompare(b.workout.date) ||
        compareInstants(a.workout.startedAt, b.workout.startedAt) ||
        a.workout.id.localeCompare(b.workout.id),
    )
    .flatMap(({ workout, sets }) =>
      sets
        .filter((set) => set.done)
        .map((set) => {
          const item = workout.items.find((i) => i.exerciseId === set.exerciseId);
          const exercise = byId.get(set.exerciseId);
          if (!item || !exercise) {
            const missing = item ? 'exercise not returned by plan' : 'no item in its workout';
            throw new Error(
              `RN-TRN-31: set ${set.id} of exercise ${set.exerciseId} has ${missing} (workout ${workout.id})`,
            );
          }
          const row: SeriesRow = {
            date: workout.date,
            week: workout.programWeek,
            session: workout.name,
            exercise: exercise.name,
            metric: exercise.metric,
            setNumber: set.setNumber,
            weightKg: set.weightKg,
            reps: set.reps,
            rir: set.rir,
            isExtra: set.isExtra,
            completedAt: set.completedAt ?? null,
          };
          return { order: item.order, row };
        })
        .sort((a, b) => a.order - b.order || a.row.setNumber - b.row.setNumber)
        .map(({ row }) => row),
    );
}
