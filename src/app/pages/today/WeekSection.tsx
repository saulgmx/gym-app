import { useId } from 'react';
import { WeekStrip, type TodayPlan } from '@/modules/plan';
import type { LocalDate } from '@/shared/kernel';
import { formatWeekSessions } from './format';
import styles from './WeekSection.module.css';

// "Esta semana" (spec 003 §6.4, AC-10): heading, "N de M sesiones" and the strip. M = workout
// days of the week in the plan; N stays 0 until phase 3 records finished sessions (P-7).
export function WeekSection({
  days,
  weekStart,
  today,
}: {
  days: TodayPlan[];
  weekStart: LocalDate;
  today: LocalDate;
}) {
  const titleId = useId();
  const planned = days.filter((day) => day.kind === 'workout').length;
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <h2 id={titleId}>Esta semana</h2>
        <p>{formatWeekSessions(0, planned)}</p>
      </div>
      <WeekStrip days={days} weekStart={weekStart} today={today} />
    </section>
  );
}
