import type { ImportFacts, Instant, LocalFacts } from '@/shared/kernel';
import type { ImportPreview } from './types';

// RN-DAT-13 (contract v1.3 §6 "Detalle de la revisión"): the preview merges each port's facts.
// Each figure comes from a single port; two ports giving the same one is a composition bug.

function merge<T extends object>(parts: readonly T[]): Partial<T> {
  const merged: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (value === undefined) continue;
      if (Object.hasOwn(merged, key)) {
        throw new Error(`RN-DAT-13: two ports provide ${key}`);
      }
      merged[key] = value;
    }
  }
  return merged as Partial<T>;
}

export function buildPreview(
  header: { exportedAt: Instant; schemaVersion: number },
  facts: readonly ImportFacts[],
  local: readonly LocalFacts[],
): ImportPreview {
  const file = merge(facts);
  const device = merge(local);
  if (file.programStartDate === undefined) {
    throw new Error('RN-DAT-13: no port provides programStartDate');
  }
  return {
    exportedAt: header.exportedAt,
    schemaVersion: header.schemaVersion,
    completedWorkouts: file.completedWorkouts ?? 0,
    doneSets: file.doneSets ?? 0,
    painEntries: file.painEntries ?? 0,
    dateRange: file.dateRange ?? null,
    hasActiveWorkout: file.hasActiveWorkout ?? false,
    programStartDate: file.programStartDate,
    currentCompletedWorkouts: device.completedWorkouts ?? 0,
  };
}
