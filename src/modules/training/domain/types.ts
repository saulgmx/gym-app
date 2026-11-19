import type { DomainError, ID, Instant, LocalDate } from '@/shared/kernel';

// Domain model of the training module (docs/modules/training.md §3, contract v1.3).
// The domain cannot import `plan` (architecture §5.2), so it declares the few exercise and plan
// facts it needs; plan's Exercise and the application's mapping fit them structurally.

export type WorkoutStatus = 'in_progress' | 'completed' | 'discarded';

export interface Workout {
  id: ID;
  templateId: ID | null; // null = free session (RF-06, not in v1)
  name: string; // template name at start, part of the snapshot
  programWeek: number | null;
  date: LocalDate; // local day it started (RN-TRN-09)
  plannedFor: LocalDate; // plan day whose session is done; = date unless another day (RN-TRN-14)
  startedAt: Instant;
  finishedAt?: Instant;
  status: WorkoutStatus;
  items: WorkoutItem[]; // snapshot of the plan at start
  notes?: string;
}

export interface WorkoutItem {
  exerciseId: ID; // the chosen exercise (RN-TRN-13); unique in the workout (RN-TRN-12)
  options: ID[]; // main first, then alternatives; [exerciseId] when there are none
  order: number;
  plannedSets: number;
  maxSets: number; // TemplateItem.sets[1], without the volume factor (RN-TRN-10)
  repRange: [number, number];
  targetRir: [number, number];
  note?: string; // template note, the technique tip (RF-17)
}

export interface SetLog {
  id: ID;
  workoutId: ID;
  exerciseId: ID;
  setNumber: number; // 1..n inside the exercise
  weightKg: number | null; // null unless metric = 'weight'; negative = assistance (RN-TRN-04)
  reps: number | null; // seconds when metric = 'time'
  rir: number | null;
  done: boolean;
  isExtra: boolean;
  completedAt?: Instant;
}

export interface ExerciseSession {
  workoutId: ID;
  date: LocalDate;
  repRange: [number, number];
  sets: SetLog[]; // done sets only, in order (RN-TRN-08)
}

/** A workout with all its sets, as the repository reads it inside a transaction. */
export interface WorkoutState {
  workout: Workout;
  sets: SetLog[];
}

/** What a change writes: the workout if it changed, sets to put and set IDs to remove. */
export interface WorkoutChanges {
  workout?: Workout;
  put: SetLog[];
  remove: ID[];
}

/** What RN-TRN-04 needs from an exercise; plan's Exercise satisfies it. */
export interface ExerciseFacts {
  id: ID;
  metric: 'weight' | 'reps' | 'time';
  equipment: string; // 'bodyweight' allows assistance (negative weight)
}

/** Input to create a workout: the plan of the day, already mapped by the application. */
export interface PlannedSession {
  templateId: ID;
  name: string;
  programWeek: number;
  items: PlannedSessionItem[]; // in order (RN-PLN-17)
}

export interface PlannedSessionItem {
  exerciseId: ID;
  alternativeIds: ID[];
  order: number;
  plannedSets: number;
  maxSets: number;
  repRange: [number, number];
  targetRir: [number, number];
  note?: string;
}

export type TrainingErrorCode =
  | 'training/workout-not-found'
  | 'training/workout-already-active'
  | 'training/workout-closed'
  | 'training/set-not-found'
  | 'training/invalid-set-values'
  | 'training/no-plan-today'
  | 'training/planned-date-out-of-week'
  | 'training/max-sets-reached'
  | 'training/set-not-removable'
  | 'training/invalid-exercise-choice'
  | 'training/item-has-done-sets'
  | 'training/pain-required' // RN-TRN-06, 22 (spec 005)
  | 'training/nothing-done'
  | 'training/notes-too-long'
  | 'training/already-done' // RN-TRN-24
  | 'training/day-already-trained'; // RN-TRN-27 (spec 005b)

export type SetField = 'weightKg' | 'reps' | 'rir';
export type SetValueProblem = 'missing' | 'not-a-number' | 'out-of-range' | 'step' | 'not-allowed';

export interface InvalidSetValuesDetails {
  field: SetField;
  reason: SetValueProblem;
}

/** What app needs to word an invalid-set-values error (ADR-0010: texts live in app). */
export interface SetErrorContext {
  metric: ExerciseFacts['metric'];
  assisted: boolean; // the assistance switch is on (negative weight)
}

export interface WorkoutAlreadyActiveDetails {
  workoutId: ID;
}

// The two codes with details carry them typed, so callers can narrow on `code`.
export type TrainingError =
  | (DomainError<'training/invalid-set-values'> & { details: InvalidSetValuesDetails })
  | (DomainError<'training/workout-already-active'> & { details: WorkoutAlreadyActiveDetails })
  | DomainError<
      Exclude<TrainingErrorCode, 'training/invalid-set-values' | 'training/workout-already-active'>
    >;
