import type { WorkoutSummary } from '@/modules/training';
import { itemsFigure, minutesFigure, setsFigure, type Figure } from '../../format-summary';

// Texts of the history list (spec 006 §6.1, plan §6.7). The figures are the Cierre's.

const text = ({ value, rest }: Figure) => `${value} ${rest}`;

/** "52 min · 10 series · 7 ejercicios", or "… · 3 de 7 ejercicios" for a partial session. */
export function formatHistorySummary(summary: WorkoutSummary): string {
  return [
    minutesFigure(summary.minutes),
    setsFigure(summary.setsDone),
    itemsFigure(summary.itemsWithDoneSets, summary.itemCount),
  ]
    .map(text)
    .join(' · ');
}
