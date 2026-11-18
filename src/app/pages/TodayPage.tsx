import { Suspense, use, useId, useState } from 'react';
import { Link } from 'react-router';
import { useTodayPlan, useWeekPlan } from '@/modules/plan';
import { useActiveWorkoutView, workoutProgress, type WorkoutView } from '@/modules/training';
import { addDays, startOfIsoWeek, type LocalDate } from '@/shared/kernel';
import { ConfirmDialog } from '@/shared/ui';
import { useApp } from '../context';
import { errorMessages } from '../errors/messages';
import { formatLongDate } from '../format-date';
import { useToday } from '../hooks/useToday';
import { discardDialogText } from './discard-dialog';
import { DayCard } from './today/DayCard';
import { ExerciseDetails } from './today/ExerciseDetails';
import { OtherDays } from './today/OtherDays';
import { TodayHeader } from './today/TodayHeader';
import { WeekSection } from './today/WeekSection';
import styles from './TodayPage.module.css';

// "Hoy" (spec 003 §6, plan §6.6). The container: it runs the queries and picks the state; the
// parts live in ./today. Nothing shows until every query answers, so "Empezar sesión" never
// flashes before "Continuar" (§6.7). A rejected `ready` is thrown by use() and shown by the
// route's ErrorFallback. The h1 stays for screen readers; the date is the first thing seen.
export function TodayPage() {
  return (
    <>
      <title>Hoy · Gym</title>
      <h1 className="visually-hidden">Hoy</h1>
      <Suspense fallback={null}>
        <TodayContent />
      </Suspense>
    </>
  );
}

function TodayContent() {
  const { plan, training, clock, ready } = useApp();
  use(ready);
  const date = useToday(clock);
  const weekStart = startOfIsoWeek(date);
  const today = useTodayPlan(plan, date);
  const week = useWeekPlan(plan, weekStart);
  // The view, not only the workout: the discard dialog counts its sets (spec 003 plan §6.4).
  const active = useActiveWorkoutView(training);
  if (!today || !week || active === undefined) return null;

  const inProgram = today.position.status === 'active';
  // Other workout days of this week, past or future (RN-TRN-14, spec 002 AC-9).
  const others = week.flatMap((day, i) => {
    const dayDate = addDays(weekStart, i);
    return day.kind === 'workout' && dayDate !== date
      ? [{ date: dayDate, name: day.template.name }]
      : [];
  });

  return (
    <>
      {/* An active session can always be continued, even from a day outside the program. Until
          T14 brings the D2 card, it shows above the day card, which then has no CTA. */}
      {active && <ActiveWorkout view={active} today={date} />}
      <TodayHeader date={date} position={today.position} />
      <DayCard today={today} date={date} canStart={!active} />
      {!active && today.kind === 'workout' && <ExerciseDetails items={today.plannedItems} />}
      {inProgram && <WeekSection days={week} weekStart={weekStart} today={date} />}
      {!active && inProgram && others.length > 0 && <OtherDays days={others} />}
    </>
  );
}

function ActiveWorkout({ view, today }: { view: WorkoutView; today: LocalDate }) {
  const { training } = useApp();
  const { workout } = view;
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const titleId = useId();

  async function discard() {
    setConfirming(false);
    const result = await training.discardWorkout(workout.id);
    setMessage(result.ok ? '' : errorMessages[result.error.code]);
  }

  const label =
    workout.date === today
      ? 'Continuar sesión'
      : `Continuar sesión del ${formatLongDate(workout.date)}`;
  return (
    <section className={styles.active} aria-labelledby={titleId}>
      <p id={titleId} className={styles.activeTitle}>
        Sesión en curso
      </p>
      <p className={styles.activeName}>{workout.name}</p>
      <Link to={`/sesion/${workout.id}`} className={styles.primary}>
        {label}
      </Link>
      <button
        type="button"
        className={styles.secondary}
        onClick={() => {
          setConfirming(true);
        }}
      >
        Descartar sesión
      </button>
      <p className={styles.problem} aria-live="polite">
        {message}
      </p>
      <ConfirmDialog
        open={confirming}
        {...discardDialogText(workoutProgress(view))}
        destructive
        onConfirm={() => void discard()}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </section>
  );
}
