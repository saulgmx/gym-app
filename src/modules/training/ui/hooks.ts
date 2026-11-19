import { useLiveQuery } from 'dexie-react-hooks';
import type { ID, LocalDate } from '@/shared/kernel';
import type { HistoryEntry, WorkoutView } from '../application/ports';
import type { TrainingApi } from '../application/service';
import type { ExerciseSession, Workout } from '../domain/types';

// Reactive training queries (docs/modules/training.md §4, RN-TRN-19). They live in `ui` because
// useLiveQuery needs Dexie (spec 001 plan §6.3) and take the API as a parameter.
//
// useLiveQuery keeps the previous result while a new key is queried, so each result carries
// the key it belongs to and a mismatch reads as still loading. undefined = loading; null = none.
// Query errors are thrown during render by useLiveQuery, for the route's error boundary.

function useKeyedQuery<T>(key: string, query: () => Promise<T>, api: TrainingApi): T | undefined {
  const keyed = useLiveQuery(async () => ({ key, value: await query() }), [api, key]);
  return keyed?.key === key ? keyed.value : undefined;
}

export function useWorkoutView(training: TrainingApi, id: ID): WorkoutView | null | undefined {
  return useKeyedQuery(id, async () => (await training.getWorkoutView(id)) ?? null, training);
}

export function useActiveWorkout(training: TrainingApi): Workout | null | undefined {
  return useKeyedQuery('active', async () => (await training.getActiveWorkout()) ?? null, training);
}

// "Hoy" in D2 (spec 003): the view of the active workout (RN-TRN-01), with its sets.
export function useActiveWorkoutView(training: TrainingApi): WorkoutView | null | undefined {
  return useKeyedQuery(
    'active-view',
    async () => (await training.getActiveWorkoutView()) ?? null,
    training,
  );
}

// "anterior" of RF-12: the last completed session of the exercise before a day.
export function useLastSession(
  training: TrainingApi,
  exerciseId: ID,
  before: LocalDate,
): ExerciseSession | null | undefined {
  return useKeyedQuery(
    `${exerciseId}|${before}`,
    async () => (await training.getExerciseHistory(exerciseId, { before, limit: 1 }))[0] ?? null,
    training,
  );
}

// Days done of a range (spec 005, RN-TRN-23, 26): [] when there are none, never null.
export function useCompletedWorkouts(
  training: TrainingApi,
  range: { from: LocalDate; to: LocalDate },
): Workout[] | undefined {
  return useKeyedQuery(`${range.from}|${range.to}`, () => training.listWorkouts(range), training);
}

// The history list (spec 006, RN-TRN-28): [] when there are none, never null. Fixed key.
export function useWorkoutHistory(training: TrainingApi): HistoryEntry[] | undefined {
  return useKeyedQuery('history', () => training.listWorkoutHistory(), training);
}
