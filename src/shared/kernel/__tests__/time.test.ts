import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareInstants,
  daysBetween,
  fixedClock,
  startOfIsoWeek,
  weekdayOf,
  type Instant,
  type LocalDate,
} from '@/shared/kernel';

const date = (s: string) => s as LocalDate;
const instant = (s: string) => s as Instant;

describe('compareInstants', () => {
  it('AC-13: compara por tiempo real, no como string, aunque cambie el offset', () => {
    // 22:30 at -06:00 is 04:30Z; 23:00 at -05:00 is 04:00Z.
    const a = instant('2026-11-16T22:30:00-06:00');
    const b = instant('2026-11-16T23:00:00-05:00');
    expect(a < b).toBe(true);
    expect(compareInstants(a, b)).toBeGreaterThan(0);
    expect(compareInstants(b, a)).toBeLessThan(0);
  });

  it('AC-13: el mismo momento con offsets distintos es igual', () => {
    expect(
      compareInstants(instant('2026-11-16T22:30:00-06:00'), instant('2026-11-17T04:30:00Z')),
    ).toBe(0);
  });

  it('AC-13: sirve como comparador de Array.sort', () => {
    const sorted = [
      instant('2026-11-16T23:00:00-05:00'),
      instant('2026-11-16T22:30:00-06:00'),
      instant('2026-11-16T03:00:00Z'),
    ].sort(compareInstants);
    expect(sorted).toEqual([
      '2026-11-16T03:00:00Z',
      '2026-11-16T23:00:00-05:00',
      '2026-11-16T22:30:00-06:00',
    ]);
  });
});

describe('addDays', () => {
  it.each([
    ['2026-11-16', 1, '2026-11-17'],
    ['2026-11-30', 1, '2026-12-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2027-02-28', 1, '2027-03-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2026-11-16', 0, '2026-11-16'],
    ['2026-01-01', 365, '2027-01-01'],
  ])('AC-14: %s + %i días = %s', (d, n, expected) => {
    expect(addDays(date(d), n)).toBe(expected);
  });

  it('AC-14: no cambia de día en las fechas de horario de verano', () => {
    // US DST changes; the arithmetic must not depend on the local time zone.
    expect(addDays(date('2026-03-08'), 1)).toBe('2026-03-09');
    expect(addDays(date('2026-11-01'), 1)).toBe('2026-11-02');
  });
});

describe('daysBetween', () => {
  it.each([
    ['2026-11-16', '2026-11-17', 1],
    ['2026-11-17', '2026-11-16', -1],
    ['2026-11-16', '2026-11-16', 0],
    ['2026-11-30', '2026-12-01', 1],
    ['2026-12-31', '2027-01-01', 1],
    ['2028-02-01', '2028-03-01', 29],
    ['2027-02-01', '2027-03-01', 28],
    ['2026-03-01', '2026-03-31', 30],
  ])('AC-14: de %s a %s hay %i días', (a, b, expected) => {
    expect(daysBetween(date(a), date(b))).toBe(expected);
  });

  it('AC-14: es la inversa de addDays', () => {
    const start = date('2026-11-16');
    for (const n of [-400, -1, 0, 1, 45, 400]) {
      expect(daysBetween(start, addDays(start, n))).toBe(n);
    }
  });
});

describe('weekdayOf', () => {
  it.each([
    ['2026-11-15', 0],
    ['2026-11-16', 1],
    ['2026-11-21', 6],
    ['2028-02-29', 2],
    ['2027-01-01', 5],
  ])('AC-14: %s es el día %i (0 = domingo)', (d, expected) => {
    expect(weekdayOf(date(d))).toBe(expected);
  });
});

describe('startOfIsoWeek', () => {
  it.each([
    ['2026-11-16', '2026-11-16'],
    ['2026-11-18', '2026-11-16'],
    ['2026-11-22', '2026-11-16'],
    ['2026-12-03', '2026-11-30'],
    ['2027-01-01', '2026-12-28'],
    ['2028-03-01', '2028-02-28'],
  ])('AC-14: la semana de %s empieza el %s', (d, expected) => {
    expect(startOfIsoWeek(date(d))).toBe(expected);
  });

  it('AC-14: siempre devuelve lunes', () => {
    const start = date('2026-12-20');
    for (let n = 0; n < 21; n++) {
      expect(weekdayOf(startOfIsoWeek(addDays(start, n)))).toBe(1);
    }
  });
});

describe('fixedClock', () => {
  it('AC-15: now() devuelve el Instant dado y today() su fecha', () => {
    const clock = fixedClock('2026-11-16T22:30:00-06:00');
    expect(clock.now()).toBe('2026-11-16T22:30:00-06:00');
    expect(clock.today()).toBe('2026-11-16');
  });

  it('AC-15: today() usa la fecha del string aunque en UTC ya sea el día siguiente', () => {
    // 23:59 at -06:00 is 05:59Z on the 17th.
    expect(fixedClock('2026-11-16T23:59:00-06:00').today()).toBe('2026-11-16');
  });

  it('AC-15: el tiempo no avanza entre llamadas', () => {
    const clock = fixedClock('2026-11-16T22:30:00-06:00');
    expect(clock.now()).toBe(clock.now());
  });
});
