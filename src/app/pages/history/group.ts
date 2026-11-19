import type { HistoryEntry } from '@/modules/training';
import { startOfIsoWeek, type LocalDate } from '@/shared/kernel';

// The weeks of the history list (spec 006 §6.1, plan §6.7). Pure.

export interface WeekGroup {
  weekStart: LocalDate; // Monday of the ISO week of `date` (plannedFor is in the same week, RN-TRN-14)
  programWeek: number | null; // of the group's first entry, the latest one; null outside the program
  entries: HistoryEntry[];
}

// By week key, so a week never shows twice even if its entries came apart; groups and entries keep
// the order of their first appearance (RN-TRN-26 already gives latest first).
export function groupByWeek(entries: HistoryEntry[]): WeekGroup[] {
  const groups = new Map<LocalDate, WeekGroup>();
  for (const entry of entries) {
    const weekStart = startOfIsoWeek(entry.workout.date);
    const group = groups.get(weekStart);
    if (group) {
      group.entries.push(entry);
    } else {
      groups.set(weekStart, {
        weekStart,
        programWeek: entry.workout.programWeek,
        entries: [entry],
      });
    }
  }
  return [...groups.values()];
}
