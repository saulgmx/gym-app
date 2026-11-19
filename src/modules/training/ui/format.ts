import type { ExerciseFacts, SetLog, WorkoutItem } from '../domain/types';

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

// Texts of the session (docs/modules/training.md §4, v1.18), exported for app: training/ui cannot
// read plan's formats (architecture §5.2, spec 004 plan §6.6).

/** [6, 10] → "6-10"; [4, 4] → "4". */
export function formatRange([min, max]: [number, number]): string {
  return min === max ? String(min) : `${String(min)}-${String(max)}`;
}

/** Planned sets × range: "2 × 6-10", or "2 × 30-45 s" when the exercise is measured in time. */
export function formatTarget(
  { plannedSets, repRange }: Pick<WorkoutItem, 'plannedSets' | 'repRange'>,
  metric: ExerciseFacts['metric'],
): string {
  return `${String(plannedSets)} × ${formatRange(repRange)}${metric === 'time' ? ' s' : ''}`;
}

/** A done set in the history (spec 006): "100 × 10 · RIR 2", "Asist. 20 × 8 · RIR 2", "40 s · RIR 2";
 *  without RIR, which RN-TRN-04 allows, just "100 × 10". */
export function formatDoneSet(set: SetLog, metric: ExerciseFacts['metric']): string {
  const value = formatPrevious(set, metric);
  return set.rir === null ? value : `${value} · RIR ${String(set.rir)}`;
}

/** "1 serie", "2 series". */
export function formatSetCount(n: number): string {
  return `${String(n)} ${n === 1 ? 'serie' : 'series'}`;
}
