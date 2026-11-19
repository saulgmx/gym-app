import { Suspense, use } from 'react';
import { useTodayPlan, useWeekPlan } from '@/modules/plan';
import { PainNotice, usePainSummary } from '@/modules/health';
import { useActiveWorkoutView, useCompletedWorkouts, useWorkoutView } from '@/modules/training';
import { addDays, startOfIsoWeek, type ID } from '@/shared/kernel';
import { useApp } from '../context';
import { useToday } from '../hooks/useToday';
import { ActiveSessionCard } from './today/ActiveSessionCard';
import { DayCard } from './today/DayCard';
import { ExerciseDetails } from './today/ExerciseDetails';
import { OtherDays } from './today/OtherDays';
import { TodayHeader } from './today/TodayHeader';
import { WeekSection } from './today/WeekSection';

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
  const { plan, training, health, clock, ready } = useApp();
  use(ready);
  const date = useToday(clock);
  const weekStart = startOfIsoWeek(date);
  const today = useTodayPlan(plan, date);
  const week = useWeekPlan(plan, weekStart);
  // The view, not only the workout: the discard dialog counts its sets (spec 003 plan §6.4).
  const active = useActiveWorkoutView(training);
  // Spec 005 (plan §6.7): days done this week, the pain summary and, if today is done, its view.
  const completed = useCompletedWorkouts(training, { from: weekStart, to: addDays(weekStart, 6) });
  const pain = usePainSummary(health);
  // Latest first (RN-TRN-26): with two for one day (broken data), the most recent (spec §7).
  const doneToday = completed?.find((w) => w.plannedFor === date);
  // Queried here, with an empty id when there is none, so the done card never shows half-loaded.
  const doneView = useWorkoutView(training, (doneToday?.id ?? '') as ID);
  if (!today || !week || active === undefined || !completed || !pain || doneView === undefined) {
    return null;
  }

  const inProgram = today.position.status === 'active';
  const done = new Set(completed.map((w) => w.plannedFor));
  // Other workout days of this week, past or future (RN-TRN-14, spec 002 AC-9).
  const others = week.flatMap((day, i) => {
    const dayDate = addDays(weekStart, i);
    return day.kind === 'workout' && dayDate !== date
      ? [{ date: dayDate, name: day.template.name, done: done.has(dayDate) }]
      : [];
  });
  const isDone = today.kind === 'workout' && doneToday !== undefined;

  return (
    <>
      <TodayHeader date={date} position={today.position} />
      {active ? (
        // D2: the session in progress takes the place of the day card; never both (§6.3). It
        // can always be continued, even from a day outside the program. No pain notice nor
        // back chip in D2 (spec 005 AC-44).
        <ActiveSessionCard view={active} today={date} />
      ) : (
        <>
          {pain.notice && <PainNotice notice={pain.notice} />}
          <DayCard
            today={today}
            date={date}
            back={pain.latest?.level ?? null}
            done={isDone ? { view: doneView, now: clock.now() } : null}
          />
          {today.kind === 'workout' && !isDone && <ExerciseDetails items={today.plannedItems} />}
        </>
      )}
      {inProgram && <WeekSection days={week} weekStart={weekStart} today={date} done={done} />}
      {!active && inProgram && others.length > 0 && <OtherDays days={others} />}
    </>
  );
}
