import { addDays, daysBetween, startOfIsoWeek, type LocalDate } from '@/shared/kernel';
import { cx } from '@/shared/ui';
import type { TodayPlan } from '../domain/types';
import styles from './WeekStrip.module.css';

// Week strip, Monday to Sunday (spec 003 §6.4, design-hoy "Tira de días"). Not interactive. Each
// day is a role="img" inside its <li>, so the strip stays a list of 7 days and each day reads as
// "<day>, [hoy,] <session>, <state>". The drawn initial and mark are only decoration. A workout day
// whose date is in `done` is "hecha" with a ✓ (spec 005, contract v1.16); app computes `done`.

const DAYS = [
  ['L', 'lunes'],
  ['M', 'martes'],
  ['X', 'miércoles'],
  ['J', 'jueves'],
  ['V', 'viernes'],
  ['S', 'sábado'],
  ['D', 'domingo'],
] as const;

type Mark = 'workout' | 'done' | 'cardio' | 'rest' | 'none';

interface DayLook {
  mark: Mark;
  text: string; // drawn inside the circle
  spoken: string; // session and state, after the day name
}

// A past workout day is "no hecha" and looks like a pending one (design-hoy): the empty ring
// (~1.5:1 contrast) is never the only cue, because a pending workout is the only day with no
// mark inside (spec 003 §6.4, WCAG 1.4.11).
// Only a workout day can be done: cardio is not recorded in v1 (spec 005 §7).
function lookOf(day: TodayPlan, offset: number, isDone: boolean): DayLook {
  switch (day.kind) {
    case 'workout':
      if (isDone) return { mark: 'done', text: '✓', spoken: `${day.template.name}, hecha` };
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
  done,
}: {
  days: TodayPlan[];
  weekStart: LocalDate;
  today: LocalDate;
  done: ReadonlySet<LocalDate>; // workout days done (RN-TRN-23); dates of other weeks are ignored
}) {
  const monday = startOfIsoWeek(weekStart);
  return (
    <ol aria-label="Semana" className={styles.strip}>
      {DAYS.map(([initial, dayName], i) => {
        const day = days[i];
        if (!day) return null;
        const dayDate = addDays(monday, i);
        const offset = daysBetween(today, dayDate);
        const { mark, text, spoken } = lookOf(day, offset, done.has(dayDate));
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
