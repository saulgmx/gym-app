import { Suspense, use, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { PlanExerciseList, useTodayPlan } from '@/modules/plan';
import { useActiveWorkout } from '@/modules/training';
import { addDays, startOfIsoWeek, type LocalDate } from '@/shared/kernel';
import { useApp } from '../context';
import { formatLongDateTitle, formatShortDay } from '../format-date';
import { useToday } from '../hooks/useToday';
import { StartWorkoutButton } from './StartWorkoutButton';
import { SessionRir } from './SessionRir';
import styles from './pages.module.css';
import todayStyles from './TodayPage.module.css';

/** The route's date if it is a real calendar day ("2026-02-30" is not). */
function parseDate(text: string | undefined): LocalDate | null {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = text as LocalDate;
  // addDays goes through UTC: an impossible day rolls over into another one.
  return addDays(date, 0) === date ? date : null;
}

// Another workout day of this week (spec 002 AC-8, plan §6.7). Anything else goes back to "Hoy"
// with replace, so the broken URL stays out of the history.
export function DayPreviewPage() {
  const { date: param } = useParams();
  const { clock } = useApp();
  const today = useToday(clock);
  const date = parseDate(param);
  if (!date || date === today || startOfIsoWeek(date) !== startOfIsoWeek(today)) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <title>{`${formatShortDay(date)} · Gym`}</title>
      <Link to="/" className={styles.backLink}>
        Volver a Hoy
      </Link>
      <Suspense fallback={null}>
        <DayPreview date={date} today={today} />
      </Suspense>
    </>
  );
}

function DayPreview({ date, today }: { date: LocalDate; today: LocalDate }) {
  const { plan, training, ready } = useApp();
  use(ready);
  const day = useTodayPlan(plan, date);
  const active = useActiveWorkout(training);
  // Decided on the first answer only: the session this page starts must not send it back.
  const [blocked, setBlocked] = useState<boolean | null>(null);
  if (blocked === null && active !== undefined) setBlocked(active !== null);
  if (!day || blocked === null) return null;
  if (blocked || day.kind !== 'workout') return <Navigate to="/" replace />;

  return (
    <>
      <h1>{formatLongDateTitle(date)}</h1>
      <section className={todayStyles.card}>
        <h2>{day.template.name}</h2>
        <SessionRir items={day.plannedItems} />
        <PlanExerciseList items={day.plannedItems} />
        <StartWorkoutButton date={today} plannedFor={date} />
      </section>
    </>
  );
}
