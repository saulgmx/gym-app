import type { Exercise, PlanApi } from '@/modules/plan';
import type { ID, LocalDate, Result } from '@/shared/kernel';
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
  // Checks RN-TRN-01, RN-TRN-24 and then RN-TRN-27, and inserts, in the same transaction.
  createIfAllowed(workout: Workout, sets: SetLog[]): Promise<CreateResult>;
  // Reads the state, calls fn and writes its changes in one transaction; undefined if no workout.
  mutate<T>(workoutId: ID, fn: ChangeFn<T>): Promise<Result<T, TrainingError> | undefined>;
  // Completed workouts with at least one set of the exercise (RN-TRN-08 filters the rest).
  findCompletedWith(exerciseId: ID): Promise<WorkoutState[]>;
  // Completed workouts with from ≤ date ≤ to, in any order (RN-TRN-26; the service sorts).
  findCompletedBetween(from: LocalDate, to: LocalDate): Promise<Workout[]>;
}

export type CreateResult =
  | { created: true }
  | { created: false; reason: 'active'; activeId: ID } // RN-TRN-01
  | { created: false; reason: 'done' } // RN-TRN-24
  | { created: false; reason: 'trained' }; // RN-TRN-27

// Implemented by health (spec 005); compose passes health.painGate (RN-TRN-06).
export interface PainGate {
  hasPainEntry(workoutId: ID): Promise<boolean>;
}
