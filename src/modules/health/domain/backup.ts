import { err, ok, type DataDescription, type ID, type Result } from '@/shared/kernel';
import type { HealthBackup, HealthError, InvalidBackupDetails } from './types';

// RN-HLT-21 (contract v1.14, decision 16): the health backup's own rules and its description.
// health never sees workouts: their existence is data's check (RN-DAT-11), and date is not
// compared with anything (RN-HLT-09).

function invalid(details: InvalidBackupDetails): Result<never, HealthError> {
  return err({
    code: 'health/invalid-backup',
    message: `Health backup breaks ${details.rule} (RN-HLT-21)`,
    details,
  });
}

function firstRepeated(ids: readonly ID[]): ID | undefined {
  const seen = new Set<ID>();
  return ids.find((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

/** (b) unique ids first, then one entry per workout. */
export function checkHealthBackup({ painEntries }: HealthBackup): Result<void, HealthError> {
  const repeatedId = firstRepeated(painEntries.map((e) => e.id));
  if (repeatedId) return invalid({ rule: 'unique-id', id: repeatedId });

  const repeatedWorkout = firstRepeated(painEntries.map((e) => e.workoutId));
  if (repeatedWorkout) return invalid({ rule: 'one-per-workout', workoutId: repeatedWorkout });

  return ok(undefined);
}

/** (d) RN-DAT-11 and RN-DAT-13. */
export function describeHealthBackup({ painEntries }: HealthBackup): DataDescription {
  return {
    facts: { painEntries: painEntries.length },
    provides: {},
    requires: { workout: painEntries.map((e) => e.workoutId) },
  };
}
