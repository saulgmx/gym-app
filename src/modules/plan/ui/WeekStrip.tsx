import { addDays, daysBetween, startOfIsoWeek, type LocalDate } from '@/shared/kernel';
import { cx } from '@/shared/ui';
import type { TodayPlan } from '../domain/types';
import styles from './WeekStrip.module.css';

// Week strip, Monday to Sunday (spec 003 §6.4, design-hoy "Tira de días"). Not interactive. Each
// day is a role="img" inside its <li>, so the strip stays a list of 7 days and each day reads as
// "<day>, [hoy,] <session>, <state>". The drawn initial and mark are only decoration. "Hecha" with
// its ✓ arrives in phase 3 (P-7).

const DAYS = [
  ['L', 'lunes'],
  ['M', 'martes'],
  ['X', 'miércoles'],
  ['J', 'jueves'],
  ['V', 'viernes'],
  ['S', 'sábado'],
  ['D', 'domingo'],
] as const;

type Mark = 'workout' | 'cardio' | 'rest' | 'none';

interface DayLook {
  mark: Mark;
  text: string; // drawn inside the circle
  spoken: string; // session and state, after the day name
}

// A past workout day is "no hecha" and looks like a pending one (design-hoy): the empty ring
// (~1.5:1 contrast) is never the only cue, because a pending workout is the only day with no
// mark inside (spec 003 §6.4, WCAG 1.4.11).
function lookOf(day: TodayPlan, offset: number): DayLook {
  switch (day.kind) {
    case 'workout':
      return {
        mark: 'workout',
        text: offset === 0 ? '●' : '',
        spoken: `${day.template.name}, ${offset < 0 ? 'no hecha' : 'pendiente'}`,
      };
    case 'cardio':
      return { mark: 'cardio', text: 'C', spoken: 'cardio' };
    case 'rest':
      return { mark: 'rest', text: '–', spoken: 'descanso' };
    case 'none':
      return { mark: 'none', text: '—', spoken: 'fuera del programa' };
  }
}

export function WeekStrip({
  days,
  weekStart,
  today,
}: {
  days: TodayPlan[];
  weekStart: LocalDate;
  today: LocalDate;
}) {
  const monday = startOfIsoWeek(weekStart);
  return (
    <ol aria-label="Semana" className={styles.strip}>
      {DAYS.map(([initial, dayName], i) => {
        const day = days[i];
        if (!day) return null;
        const offset = daysBetween(today, addDays(monday, i));
        const { mark, text, spoken } = lookOf(day, offset);
        const isToday = offset === 0;
        const label = `${dayName}, ${isToday ? 'hoy, ' : ''}${spoken}`;
        return (
          <li key={dayName} className={styles.day}>
            <div role="img" aria-label={label} className={styles.figure}>
              <span aria-hidden="true" className={styles.initial}>
                {initial}
              </span>
              <span
                aria-hidden="true"
                data-mark={mark}
                data-today={isToday || undefined}
                className={cx(styles.mark, styles[mark], isToday && styles.today)}
              >
                {text}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
