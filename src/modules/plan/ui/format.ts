import type { Metric } from '../domain/types';

// Texts of the "Hoy" list (spec 001 AC-15, plan §6.10).

/** [3, 4] → "3-4"; [4, 4] → "4". */
export function formatRange([min, max]: [number, number]): string {
  return min === max ? String(min) : `${String(min)}-${String(max)}`;
}

/** "2 × 8-12", or "3 × 30-45 s" when the exercise is measured in time. */
export function formatSetsReps(sets: number, reps: [number, number], metric: Metric): string {
  return `${String(sets)} × ${formatRange(reps)}${metric === 'time' ? ' s' : ''}`;
}

/** "RIR 3-4". */
export function formatRir(rir: [number, number]): string {
  return `RIR ${formatRange(rir)}`;
}
