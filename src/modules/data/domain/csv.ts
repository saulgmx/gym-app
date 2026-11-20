// RN-DAT-14 (spec 008 plan §6.5): the text and filename of the series CSV.

import type { LocalDate, SeriesRow } from '@/shared/kernel';

export const CSV_VERSION = 1;

export const CSV_COLUMNS = [
  'date',
  'week',
  'session',
  'exercise',
  'metric',
  'setNumber',
  'weightKg',
  'reps',
  'rir',
  'isExtra',
  'completedAt',
] as const satisfies readonly (keyof SeriesRow)[];

/** Format a single field value for CSV output. */
function formatValue(v: SeriesRow[keyof SeriesRow]): string {
  if (v === null) return '';

  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';

  const needsQuoting = /[,"\r\n]/.test(v);
  if (needsQuoting) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Build series CSV from rows. */
export function seriesCsv(rows: readonly SeriesRow[]): string {
  const header = CSV_COLUMNS.join(',');

  if (rows.length === 0) {
    return `\uFEFF${header}\r\n`;
  }

  const lines = rows.map((row) => CSV_COLUMNS.map((col) => formatValue(row[col])).join(','));

  return `\uFEFF${header}\r\n${lines.join('\r\n')}\r\n`;
}

/** Build series filename from today's date. */
export function csvFilename(today: LocalDate): string {
  return `gym-series-v${String(CSV_VERSION)}-${today}.csv`;
}
