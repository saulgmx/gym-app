import { Suspense, use } from 'react';
import {
  PlanExerciseList,
  useTodayPlan,
  useWeekPlan,
  WeekStrip,
  type TodayPlan,
} from '@/modules/plan';
import { startOfIsoWeek } from '@/shared/kernel';
import { useApp } from '../context';
import { formatLongDate, formatLongDateTitle } from '../format-date';
import { useToday } from '../hooks/useToday';
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
  const { plan, clock, ready } = useApp();
  use(ready);
  const date = useToday(clock);
  const weekStart = startOfIsoWeek(date);
  const today = useTodayPlan(plan, date);
  const week = useWeekPlan(plan, weekStart);
  if (!today || !week) return null;

  const { position } = today;
  const dateLine = <p className={styles.date}>{formatLongDateTitle(date)}</p>;

  if (position.status === 'not_started') {
    return (
      <>
        {dateLine}
        <p>{`El plan empieza el ${formatLongDate(position.startDate)}.`}</p>
      </>
    );
  }
  if (position.status === 'finished') {
    return (
      <>
        {dateLine}
        <p>{`Terminaste el plan de ${String(position.totalWeeks)} semanas.`}</p>
      </>
    );
  }

  return (
    <>
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
      </section>
    </>
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
