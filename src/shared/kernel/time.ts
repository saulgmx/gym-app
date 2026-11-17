import type { Instant, LocalDate, Weekday } from './types';

const MS_PER_DAY = 86_400_000;

// LocalDate arithmetic runs in UTC so DST changes never shift a day (plan §6.6).
function toUtcMs(d: LocalDate): number {
  return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10) as LocalDate;
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return (toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY;
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtcMs(toUtcMs(d) + n * MS_PER_DAY);
}

export function weekdayOf(d: LocalDate): Weekday {
  return new Date(toUtcMs(d)).getUTCDay() as Weekday;
}

export function startOfIsoWeek(d: LocalDate): LocalDate {
  const daysSinceMonday = (weekdayOf(d) + 6) % 7;
  return addDays(d, -daysSinceMonday);
}

// Never compare Instants as strings: different offsets sort wrong (ADR-0009).
export function compareInstants(a: Instant, b: Instant): number {
  return Date.parse(a) - Date.parse(b);
}
