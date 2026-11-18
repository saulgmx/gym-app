import type { Exercise, PlanApi } from '@/modules/plan';
import type { ID, Result } from '@/shared/kernel';
import type { SetLog, TrainingError, Workout, WorkoutChanges, WorkoutState } from '../domain/types';

// What the training service needs from outside (docs/modules/training.md §4, plan §6.1).
// Only this layer may import `plan` (architecture §5.2), so ui and tests take its types from here.
export type {
  Exercise,
  PlannedItem,
  ProgramPosition,
  SessionTemplate,
  TodayPlan,
} from '@/modules/plan';

export type PlanReader = Pick<PlanApi, 'getTodayPlan' | 'getExercises'>;

export interface PrefillSuggestion {
  weightKg: number | null;
  reps?: number;
  message: string;
  tone: 'up' | 'hold' | 'down' | 'neutral' | 'blocked';
}

// Implemented by progression (phase 4); compose passes a null provider until then.
export interface SuggestionProvider {
  getPrefill(exerciseId: ID): Promise<PrefillSuggestion | null>;
}

/** What the session page needs, in one reactive query (RN-TRN-17). */
export interface WorkoutView {
  workout: Workout;
  sets: SetLog[]; // by item order, then setNumber
  exercises: Record<ID, Exercise>; // every option of every item
}

export type ChangeFn<T> = (
  state: WorkoutState,
) => Result<{ changes: WorkoutChanges; value: T }, TrainingError>;

export interface TrainingRepository {
  findSet(setId: ID): Promise<SetLog | undefined>;
  load(workoutId: ID): Promise<WorkoutState | undefined>;
  findInProgress(): Promise<Workout[]>;
  // Checks RN-TRN-01 and inserts in the same transaction.
  createIfNoneActive(
    workout: Workout,
    sets: SetLog[],
  ): Promise<{ created: true } | { created: false; activeId: ID }>;
  // Reads the state, calls fn and writes its changes in one transaction; undefined if no workout.
  mutate<T>(workoutId: ID, fn: ChangeFn<T>): Promise<Result<T, TrainingError> | undefined>;
  // Completed workouts with at least one set of the exercise (RN-TRN-08 filters the rest).
  findCompletedWith(exerciseId: ID): Promise<WorkoutState[]>;
}
