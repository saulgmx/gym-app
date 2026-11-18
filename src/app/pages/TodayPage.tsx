import { Suspense, use } from 'react';
import { useTodayPlan, useWeekPlan } from '@/modules/plan';
import { useActiveWorkoutView } from '@/modules/training';
import { addDays, startOfIsoWeek } from '@/shared/kernel';
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
      <TodayHeader date={date} position={today.position} />
      {active ? (
        // D2: the session in progress takes the place of the day card; never both (§6.3). It
        // can always be continued, even from a day outside the program.
        <ActiveSessionCard view={active} today={date} />
      ) : (
        <>
          <DayCard today={today} date={date} />
          {today.kind === 'workout' && <ExerciseDetails items={today.plannedItems} />}
        </>
      )}
      {inProgram && <WeekSection days={week} weekStart={weekStart} today={date} />}
      {!active && inProgram && others.length > 0 && <OtherDays days={others} />}
    </>
  );
}
