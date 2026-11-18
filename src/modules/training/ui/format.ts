import type { ExerciseFacts, SetLog } from '../domain/types';

// Texts of the set table (docs/modules/training.md §4, SetTable). Decimal comma, as typed.

/** 62.5 → "62,5". */
export function formatNumber(n: number): string {
  return String(n).replace('.', ',');
}

/** The "anterior" cell: "60 × 10", "Asist. 20 × 8", "10", "40 s" or "—". */
export function formatPrevious(set: SetLog | undefined, metric: ExerciseFacts['metric']): string {
  if (set?.reps == null) return '—';
  const reps = formatNumber(set.reps);
  if (metric === 'time') return `${reps} s`;
  if (metric === 'reps' || set.weightKg === null) return reps;
  return set.weightKg < 0
    ? `Asist. ${formatNumber(-set.weightKg)} × ${reps}`
    : `${formatNumber(set.weightKg)} × ${reps}`;
}
