import { describe, expect, it } from 'vitest';
import type { HistoryEntry, Workout } from '@/modules/training';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { formatWeekRange } from '../format-date';
import { formatHistorySummary } from '../pages/history/format';
import { groupByWeek } from '../pages/history/group';

// Texts and grouping of the history list (spec 006 §6.1, plan §6.7 and §6.10). Expected dates
// computed with Node (Intl es).

const date = (s: string) => s as LocalDate;

describe('formatWeekRange', () => {
  it('spec 006 AC-6: el lunes y el domingo de la semana, con el mes una vez', () => {
    expect(formatWeekRange(date('2026-11-16'))).toBe('16-22 nov');
    expect(formatWeekRange(date('2026-11-23'))).toBe('23-29 nov');
  });

  it('spec 006 §6.1: si la semana cruza de mes, el mes de cada extremo', () => {
    expect(formatWeekRange(date('2026-11-30'))).toBe('30 nov-6 dic');
  });

  it('spec 006 §6.1: si cruza de año, sin el año', () => {
    expect(formatWeekRange(date('2026-12-28'))).toBe('28 dic-3 ene');
  });

  it('septiembre con el nombre corto de Intl', () => {
    expect(formatWeekRange(date('2026-09-07'))).toBe('7-13 sept');
  });
});

describe('formatHistorySummary', () => {
  it('spec 006 AC-7: sesión completa', () => {
    expect(
      formatHistorySummary({ minutes: 52, setsDone: 10, itemsWithDoneSets: 7, itemCount: 7 }),
    ).toBe('52 min · 10 series · 7 ejercicios');
  });

  it('spec 006 AC-8: sesión parcial, "N de M ejercicios"', () => {
    expect(
      formatHistorySummary({ minutes: 30, setsDone: 5, itemsWithDoneSets: 3, itemCount: 7 }),
    ).toBe('30 min · 5 series · 3 de 7 ejercicios');
  });

  it('singulares, como el Cierre', () => {
    expect(
      formatHistorySummary({ minutes: 1, setsDone: 1, itemsWithDoneSets: 1, itemCount: 1 }),
    ).toBe('1 min · 1 serie · 1 ejercicio');
  });
});

describe('groupByWeek', () => {
  const entry = (key: string, d: string, programWeek: number | null): HistoryEntry => ({
    workout: {
      id: key as ID,
      templateId: 'tpl' as ID,
      name: 'Full body A',
      programWeek,
      date: date(d),
      plannedFor: date(d),
      startedAt: `${d}T18:00:00-06:00` as Instant,
      finishedAt: `${d}T18:52:00-06:00` as Instant,
      status: 'completed',
      items: [],
    } satisfies Workout,
    summary: { minutes: 52, setsDone: 10, itemsWithDoneSets: 7, itemCount: 7 },
  });
  const shape = (groups: ReturnType<typeof groupByWeek>) =>
    groups.map((g) => ({
      weekStart: g.weekStart,
      programWeek: g.programWeek,
      ids: g.entries.map((e) => e.workout.id),
    }));

  it('spec 006 AC-5: un grupo por semana ISO del date, en el orden de las entradas', () => {
    const groups = groupByWeek([
      entry('L23', '2026-11-23', 2),
      entry('M18', '2026-11-18', 1),
      entry('D22', '2026-11-22', 1), // Sunday: still week 1
      entry('L16', '2026-11-16', 1),
    ]);

    expect(shape(groups)).toEqual([
      { weekStart: '2026-11-23', programWeek: 2, ids: ['L23'] },
      { weekStart: '2026-11-16', programWeek: 1, ids: ['M18', 'D22', 'L16'] },
    ]);
  });

  it('spec 006 §6.1: una semana sale una sola vez aunque sus entradas no lleguen juntas', () => {
    const groups = groupByWeek([
      entry('M18', '2026-11-18', 1),
      entry('L23', '2026-11-23', 2),
      entry('L16', '2026-11-16', 1),
    ]);

    expect(shape(groups)).toEqual([
      { weekStart: '2026-11-16', programWeek: 1, ids: ['M18', 'L16'] },
      { weekStart: '2026-11-23', programWeek: 2, ids: ['L23'] },
    ]);
  });

  it('spec 006 §7: el programWeek del grupo es el de su primera entrada (la más reciente)', () => {
    const groups = groupByWeek([entry('V20', '2026-11-20', 3), entry('L16', '2026-11-16', 2)]);

    expect(shape(groups)).toEqual([
      { weekStart: '2026-11-16', programWeek: 3, ids: ['V20', 'L16'] },
    ]);
  });

  it('spec 006 AC-12: fuera del programa → programWeek null', () => {
    expect(shape(groupByWeek([entry('fuera', '2026-11-11', null)]))).toEqual([
      { weekStart: '2026-11-09', programWeek: null, ids: ['fuera'] },
    ]);
  });

  it('sin entradas → []', () => {
    expect(groupByWeek([])).toEqual([]);
  });
});
