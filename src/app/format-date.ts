import { addDays, type Instant, type LocalDate } from '@/shared/kernel';

// Visible dates in Spanish (spec 001 plan §6.7, §6.11). A LocalDate is formatted at UTC midnight,
// as the kernel computes it (ADR-0009), so the device's time zone never shifts the day.

const weekday = new Intl.DateTimeFormat('es', { weekday: 'long', timeZone: 'UTC' });
const dayAndMonth = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** "viernes": the weekday alone, in lower case (spec 005b, "Full body A del viernes"). */
export function formatWeekday(date: LocalDate): string {
  return weekday.format(new Date(`${date}T00:00:00Z`));
}

/** "lunes 16 de noviembre": built in two parts, since Intl puts a comma after the weekday. */
export function formatLongDate(date: LocalDate): string {
  return `${formatWeekday(date)} ${dayAndMonth.format(new Date(`${date}T00:00:00Z`))}`;
}

/** "Lunes 16 de noviembre", for the start of a line. */
export function formatLongDateTitle(date: LocalDate): string {
  const text = formatLongDate(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const shortWeekday = new Intl.DateTimeFormat('es', { weekday: 'short', timeZone: 'UTC' });

/** "Lun 16", for the day buttons of "Otra sesión de esta semana". */
export function formatShortDay(date: LocalDate): string {
  const instant = new Date(`${date}T00:00:00Z`);
  const day = shortWeekday.format(instant).replace('.', '');
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${String(instant.getUTCDate())}`;
}

const shortMonth = new Intl.DateTimeFormat('es', { month: 'short', timeZone: 'UTC' });

/** "Miércoles 18 nov", for the top row of "Hoy" (spec 003 AC-1). Some Intl data writes the short
 *  month with a period ("nov."), as reported on iOS Safari; Node and the Playwright WebKit do not.
 *  It is removed, as in formatShortDay (format-date-period.test.ts makes Intl add it). */
export function formatShortDateTitle(date: LocalDate): string {
  const instant = new Date(`${date}T00:00:00Z`);
  const day = weekday.format(instant);
  const month = shortMonth.format(instant).replace('.', '');
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${String(instant.getUTCDate())} ${month}`;
}

/** "16-22 nov", or "30 nov-6 dic" when the week crosses a month (also a year, without it): the
 *  week of a history group (spec 006 §6.1). The month has no period, as in formatShortDateTitle. */
export function formatWeekRange(weekStart: LocalDate): string {
  const from = new Date(`${weekStart}T00:00:00Z`);
  const to = new Date(`${addDays(weekStart, 6)}T00:00:00Z`);
  const month = (d: Date) => shortMonth.format(d).replace('.', '');
  const day = (d: Date) => String(d.getUTCDate());
  return month(from) === month(to)
    ? `${day(from)}-${day(to)} ${month(to)}`
    : `${day(from)} ${month(from)}-${day(to)} ${month(to)}`;
}

// Spec 007 §8 decision 14: the long dates of the restore preview.

const day = (d: LocalDate) => String(new Date(`${d}T00:00:00Z`).getUTCDate());
const longDate = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayAndLongMonth = (d: LocalDate) => dayAndMonth.format(new Date(`${d}T00:00:00Z`));
const fullDate = (d: LocalDate) => longDate.format(new Date(`${d}T00:00:00Z`));

/** "lunes 16 de noviembre de 2026": the program's start in the preview (AC-14). */
export function formatWeekdayDateLong(date: LocalDate): string {
  return `${formatWeekday(date)} ${fullDate(date)}`;
}

/** "Del 16 al 18 de noviembre de 2026"; the year only at the end when it is the same, in both
 *  parts when it changes; "El 16 de noviembre de 2026" for a single day (decision 14 (c), (d)). */
export function formatDateRangeLong(from: LocalDate, to: LocalDate): string {
  if (from === to) return `El ${fullDate(from)}`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  if (sameYear && from.slice(0, 7) === to.slice(0, 7)) return `Del ${day(from)} al ${fullDate(to)}`;
  if (sameYear) return `Del ${dayAndLongMonth(from)} al ${fullDate(to)}`;
  return `Del ${fullDate(from)} al ${fullDate(to)}`;
}

/** "19 de noviembre de 2026, 22:30" in the device's time. The time is built by hand: Intl writes
 *  "a las 22:30" in Node and engines differ (decision 14 (a), (b)). Created per call, so the
 *  device's current time zone applies. */
export function formatInstantLong(instant: Instant): string {
  const when = new Date(instant);
  const date = new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(when);
  const minutes = String(when.getMinutes()).padStart(2, '0');
  return `${date}, ${String(when.getHours())}:${minutes}`;
}
