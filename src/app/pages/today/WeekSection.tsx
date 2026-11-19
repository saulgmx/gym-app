import { useId } from 'react';
import { WeekStrip, type TodayPlan } from '@/modules/plan';
import { addDays, type LocalDate } from '@/shared/kernel';
import { formatWeekSessions } from './format';
import styles from './WeekSection.module.css';

// "Esta semana" (spec 003 §6.4, AC-10; spec 005 AC-32): heading, "N de M sesiones" and the strip.
// M = workout days of the week in the plan; N = those already done (RN-TRN-23). N counts days,
// not workouts: two closed workouts for one day (broken data) count once (spec 005 §7).
export function WeekSection({
  days,
  weekStart,
  today,
  done,
}: {
  days: TodayPlan[];
  weekStart: LocalDate; // the Monday
  today: LocalDate;
  done: ReadonlySet<LocalDate>;
}) {
  const titleId = useId();
  const workoutDays = days.flatMap((day, i) =>
    day.kind === 'workout' ? [addDays(weekStart, i)] : [],
  );
  const doneCount = workoutDays.filter((day) => done.has(day)).length;
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <h2 id={titleId}>Esta semana</h2>
        <p>{formatWeekSessions(doneCount, workoutDays.length)}</p>
      </div>
      <WeekStrip days={days} weekStart={weekStart} today={today} done={done} />
    </section>
  );
}
