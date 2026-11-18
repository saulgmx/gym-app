import type { LocalDate } from '@/shared/kernel';

// Visible dates in Spanish (spec 001 plan §6.7, §6.11). A LocalDate is formatted at UTC midnight,
// as the kernel computes it (ADR-0009), so the device's time zone never shifts the day.

const weekday = new Intl.DateTimeFormat('es', { weekday: 'long', timeZone: 'UTC' });
const dayAndMonth = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** "lunes 16 de noviembre": built in two parts, since Intl puts a comma after the weekday. */
export function formatLongDate(date: LocalDate): string {
  const instant = new Date(`${date}T00:00:00Z`);
  return `${weekday.format(instant)} ${dayAndMonth.format(instant)}`;
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

/** "Miércoles 18 nov", for the top row of "Hoy" (spec 003 AC-1). WebKit adds a period to the
 *  short month ("nov."); it is removed, as in formatShortDay. */
export function formatShortDateTitle(date: LocalDate): string {
  const instant = new Date(`${date}T00:00:00Z`);
  const day = weekday.format(instant);
  const month = shortMonth.format(instant).replace('.', '');
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${String(instant.getUTCDate())} ${month}`;
}
