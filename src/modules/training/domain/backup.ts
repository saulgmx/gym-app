import {
  err,
  ok,
  type DataDescription,
  type ID,
  type LocalDate,
  type Result,
} from '@/shared/kernel';
import type { InvalidBackupDetails, TrainingBackup, TrainingError } from './types';

// RN-TRN-30 (contract v1.31, decision 33): the training backup's own rules and its description.
// Only what the app never tolerates is checked (RN-DAT-12): no RN-TRN-06, RN-TRN-27 or RN-TRN-04.

function invalid(details: InvalidBackupDetails): Result<never, TrainingError> {
  return err({
    code: 'training/invalid-backup',
    message: `Training backup breaks ${details.rule} (RN-TRN-30)`,
    details,
  });
}

function firstRepeated(ids: readonly ID[]): ID | undefined {
  const seen = new Set<ID>();
  return ids.find((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

/** The first broken rule, in the contract's order (f). */
export function checkTrainingBackup({
  workouts,
  sets,
}: TrainingBackup): Result<void, TrainingError> {
  const repeatedWorkout = firstRepeated(workouts.map((w) => w.id));
  if (repeatedWorkout) return invalid({ rule: 'unique-workout-id', id: repeatedWorkout });

  const repeatedSet = firstRepeated(sets.map((s) => s.id));
  if (repeatedSet) return invalid({ rule: 'unique-set-id', id: repeatedSet });

  const workoutIds = new Set(workouts.map((w) => w.id));
  const orphan = sets.find((s) => !workoutIds.has(s.workoutId));
  if (orphan) {
    return invalid({ rule: 'set-without-workout', setId: orphan.id, workoutId: orphan.workoutId });
  }

  const active = workouts.filter((w) => w.status === 'in_progress').map((w) => w.id);
  if (active.length > 1) return invalid({ rule: 'one-active', workoutIds: active });

  return ok(undefined);
}

/** Preview facts and references (RN-DAT-11, RN-DAT-13). Dates are LocalDate: compared as text. */
export function describeTrainingBackup({ workouts, sets }: TrainingBackup): DataDescription {
  const completed = workouts.filter((w) => w.status === 'completed');
  const completedIds = new Set(completed.map((w) => w.id));
  const dates = completed.map((w) => w.date).sort();
  const first: LocalDate | undefined = dates[0];
  const last: LocalDate | undefined = dates[dates.length - 1];

  // (e) without repeats, in order of appearance: items (chosen, then options), then sets.
  const exercises = new Set<ID>();
  for (const w of workouts) {
    for (const item of w.items) {
      exercises.add(item.exerciseId);
      for (const option of item.options) exercises.add(option);
    }
  }
  for (const s of sets) exercises.add(s.exerciseId);

  return {
    facts: {
      completedWorkouts: completed.length,
      doneSets: sets.filter((s) => s.done && completedIds.has(s.workoutId)).length,
      dateRange: first && last ? { from: first, to: last } : null,
      hasActiveWorkout: workouts.some((w) => w.status === 'in_progress'),
    },
    provides: { workout: workouts.map((w) => w.id) },
    requires: { exercise: [...exercises] },
  };
}
