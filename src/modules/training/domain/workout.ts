import {
  err,
  ok,
  startOfIsoWeek,
  type ID,
  type IdGenerator,
  type Instant,
  type LocalDate,
  type Result,
} from '@/shared/kernel';
import { checkSetValues } from './set-values';
import type {
  ExerciseFacts,
  PlannedSession,
  SetLog,
  TrainingError,
  Workout,
  WorkoutItem,
} from './types';

// Workout rules (docs/modules/training.md §6). Pure: time and IDs come in as parameters.

/** RN-TRN-14: the plan day must be in the same ISO week as the day the session starts. */
export function checkPlannedFor(
  date: LocalDate,
  plannedFor: LocalDate,
): Result<void, TrainingError> {
  if (startOfIsoWeek(date) === startOfIsoWeek(plannedFor)) return ok(undefined);
  return err({
    code: 'training/planned-date-out-of-week',
    message: `${plannedFor} is not in the week of ${date} (RN-TRN-14)`,
  });
}

// RN-TRN-02: a suggestion that breaks RN-TRN-04, or any weight on reps or time, starts empty.
function prefillFor(exercise: ExerciseFacts, suggested: number | null | undefined): number | null {
  if (suggested === undefined || suggested === null) return null;
  const checked = checkSetValues({ weightKg: suggested, reps: null, rir: null }, exercise, {
    forDone: false,
  });
  return checked.ok ? checked.value.weightKg : null;
}

/** RN-TRN-02, 12: the workout and its empty sets, from the plan of the day. */
export function createWorkout(input: {
  session: PlannedSession;
  date: LocalDate;
  plannedFor: LocalDate;
  now: Instant;
  ids: IdGenerator;
  exercises: ExerciseFacts[]; // at least every main exercise
  prefill: ReadonlyMap<ID, number | null>;
}): { workout: Workout; sets: SetLog[] } {
  const { session, ids } = input;

  // RN-TRN-12: an exercise appears in one item only, as main or alternative.
  const seen = new Set<ID>();
  for (const { exerciseId, alternativeIds } of session.items) {
    for (const option of [exerciseId, ...alternativeIds]) {
      if (seen.has(option)) throw new Error(`Exercise ${option} in two items (RN-TRN-12)`);
      seen.add(option);
    }
  }

  const items = [...session.items]
    .sort((a, b) => a.order - b.order)
    .map((item): WorkoutItem => ({
      exerciseId: item.exerciseId,
      options: [item.exerciseId, ...item.alternativeIds],
      order: item.order,
      plannedSets: item.plannedSets,
      maxSets: item.maxSets,
      repRange: item.repRange,
      targetRir: item.targetRir,
      ...(item.note === undefined ? {} : { note: item.note }),
    }));

  const workout: Workout = {
    id: ids.next(),
    templateId: session.templateId,
    programWeek: session.programWeek,
    date: input.date,
    plannedFor: input.plannedFor,
    startedAt: input.now,
    status: 'in_progress',
    items,
  };

  const sets = items.flatMap((item) => {
    const exercise = input.exercises.find((e) => e.id === item.exerciseId);
    if (!exercise) throw new Error(`Exercise ${item.exerciseId} missing from exercises`);
    const weightKg = prefillFor(exercise, input.prefill.get(item.exerciseId));
    return Array.from({ length: item.plannedSets }, (_, i): SetLog => ({
      id: ids.next(),
      workoutId: workout.id,
      exerciseId: item.exerciseId,
      setNumber: i + 1,
      weightKg,
      reps: null,
      rir: null,
      done: false,
      isExtra: false,
    }));
  });

  return { workout, sets };
}
