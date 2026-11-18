import { Suspense, use, useId, useState } from 'react';
import { Link } from 'react-router';
import {
  PlanExerciseList,
  useTodayPlan,
  useWeekPlan,
  WeekStrip,
  type TodayPlan,
} from '@/modules/plan';
import { useActiveWorkout, type Workout } from '@/modules/training';
import { addDays, startOfIsoWeek, type LocalDate } from '@/shared/kernel';
import { ConfirmDialog } from '@/shared/ui';
import { useApp } from '../context';
import { errorMessages } from '../errors/messages';
import { formatLongDate, formatLongDateTitle, formatShortDay } from '../format-date';
import { useToday } from '../hooks/useToday';
import { StartWorkoutButton } from './StartWorkoutButton';
import styles from './TodayPage.module.css';

// "Hoy" (spec 001 §6, AC-15 to AC-21, plan §6.11). Only the title shows until the plan is ready
// and the queries answer, so the page never flashes an empty or partial state. A rejected
// `ready` is thrown by use() and shown by the route's ErrorFallback.
export function TodayPage() {
  return (
    <>
      <title>Hoy · Gym</title>
      <h1>Hoy</h1>
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
  const active = useActiveWorkout(training);
  // Nothing until every query answers, so "Iniciar sesión" never flashes before "Continuar".
  if (!today || !week || active === undefined) return null;

  const { position } = today;
  const dateLine = <p className={styles.date}>{formatLongDateTitle(date)}</p>;
  // An active session can always be continued, even if it is from a day outside the program.
  const current = active && <ActiveWorkout workout={active} today={date} />;

  if (position.status === 'not_started') {
    return (
      <>
        {current}
        {dateLine}
        <p>{`El plan empieza el ${formatLongDate(position.startDate)}.`}</p>
      </>
    );
  }
  if (position.status === 'finished') {
    return (
      <>
        {current}
        {dateLine}
        <p>{`Terminaste el plan de ${String(position.totalWeeks)} semanas.`}</p>
      </>
    );
  }

  // Other workout days of this week, past or future (RN-TRN-14, AC-9).
  const others = week.flatMap((day, i) => {
    const dayDate = addDays(weekStart, i);
    return day.kind === 'workout' && dayDate !== date
      ? [{ date: dayDate, name: day.template.name }]
      : [];
  });

  return (
    <>
      {current}
      <div className={styles.header}>
        {dateLine}
        <p>{position.block?.name}</p>
        <p>
          {`Semana ${String(position.week)} de ${String(position.totalWeeks)}`}
          {position.isDeloadWeek && ' · Semana de descarga'}
        </p>
      </div>
      <WeekStrip days={week} weekStart={weekStart} today={date} />
      <section className={styles.card}>
        <DayBody today={today} />
        {!active && today.kind === 'workout' && (
          <StartWorkoutButton date={date} plannedFor={date} />
        )}
      </section>
      {!active && others.length > 0 && <OtherDays days={others} />}
    </>
  );
}

function ActiveWorkout({ workout, today }: { workout: Workout; today: LocalDate }) {
  const { training } = useApp();
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
        title="¿Descartar la sesión?"
        message="No contará en tu historial y no podrás retomarla."
        confirmLabel="Descartar"
        destructive
        onConfirm={() => void discard()}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </section>
  );
}

function OtherDays({ days }: { days: { date: LocalDate; name: string }[] }) {
  const titleId = useId();
  return (
    <section className={styles.others} aria-labelledby={titleId}>
      <h2 id={titleId}>Otra sesión de esta semana</h2>
      <ul className={styles.otherList}>
        {days.map((day) => (
          <li key={day.date}>
            <Link to={`/dia/${day.date}`} className={styles.secondary}>
              {`${formatShortDay(day.date)} · ${day.name}`}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DayBody({ today }: { today: TodayPlan }) {
  switch (today.kind) {
    case 'workout':
      return (
        <>
          <h2>{today.template.name}</h2>
          <PlanExerciseList items={today.plannedItems} />
        </>
      );
    case 'cardio':
      return (
        <>
          <h2>Cardio</h2>
          <p>{today.note}</p>
        </>
      );
    case 'rest':
      return (
        <>
          <h2>Descanso</h2>
          <p>Recupera: dormir y comer bien también es entrenar.</p>
        </>
      );
    case 'none':
      return null; // outside the program, handled above
  }
}
