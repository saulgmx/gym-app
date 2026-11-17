import { addDays, startOfIsoWeek, type LocalDate } from '@/shared/kernel';
import { cx } from '@/shared/ui';
import type { TodayPlan } from '../domain/types';
import styles from './WeekStrip.module.css';

// Week strip, Monday to Sunday (spec 001 AC-17, plan §6.10). Not interactive. The drawn initial
// and indicator are hidden from screen readers, which read "miércoles, Full body B" instead.

const DAYS = [
  ['L', 'lunes'],
  ['M', 'martes'],
  ['X', 'miércoles'],
  ['J', 'jueves'],
  ['V', 'viernes'],
  ['S', 'sábado'],
  ['D', 'domingo'],
] as const;

/** Text indicator, so the kind of day never depends on color alone (WCAG 1.4.1). */
function describeDay(day: TodayPlan): { indicator: string; session: string } {
  switch (day.kind) {
    case 'workout':
      return { indicator: 'Pesas', session: day.template.name };
    case 'cardio':
      return { indicator: 'Cardio', session: 'cardio' };
    case 'rest':
      return { indicator: 'Libre', session: 'descanso' };
    case 'none':
      return { indicator: '—', session: 'fuera del programa' };
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
        const { indicator, session } = describeDay(day);
        const isToday = addDays(monday, i) === today;
        return (
          <li
            key={dayName}
            className={cx(styles.day, isToday && styles.today)}
            aria-current={isToday ? 'date' : undefined}
          >
            <span aria-hidden="true" className={styles.initial}>
              {initial}
            </span>
            <span aria-hidden="true" className={styles.indicator}>
              {indicator}
            </span>
            <span className="visually-hidden">{`${dayName}, ${session}`}</span>
          </li>
        );
      })}
    </ol>
  );
}
