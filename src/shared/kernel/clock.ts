import type { Clock, Instant, LocalDate } from './types';

const pad = (n: number): string => String(n).padStart(2, '0');

function localDate(d: Date): LocalDate {
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as LocalDate;
}

function localInstant(d: Date): Instant {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const zone = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return `${localDate(d)}T${time}${zone}` as Instant;
}

// Production clock: the device's local day and offset (plan §6.6).
export const systemClock: Clock = {
  now: () => localInstant(new Date()),
  today: () => localDate(new Date()),
};

// Test clock: today() is the date written in the string, whatever the machine's time zone.
export function fixedClock(now: string): Clock {
  return {
    now: () => now as Instant,
    today: () => now.slice(0, 10) as LocalDate,
  };
}
