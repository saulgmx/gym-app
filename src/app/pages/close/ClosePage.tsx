import { Suspense, use, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useWorkoutView, workoutProgress, type WorkoutView } from '@/modules/training';
import type { ID } from '@/shared/kernel';
import { useApp } from '../../context';
import { GENERIC_ERROR_MESSAGE, errorMessages } from '../../errors/messages';
import pageStyles from '../pages.module.css';
import { CloseForm, type CloseValues } from './CloseForm';
import { CLOSE_TEXTS } from './format';

// The Cierre of a session (spec 005 §6.1, AC-7 to AC-31; plan §6.5, §6.6): saves the pain, then
// closes the workout, and goes back to "Hoy".
export function ClosePage() {
  return (
    <main className={pageStyles.fullScreen}>
      <title>Cierre de sesión · Gym</title>
      <Suspense fallback={null}>
        <CloseContent />
      </Suspense>
    </main>
  );
}

/** Plan §6.6: `state.from` if it is an item index; else the current item, or 1 if all is done. */
function backIndex(view: WorkoutView, state: unknown): number {
  const from = (state as { from?: unknown } | null)?.from;
  const n = view.workout.items.length;
  if (typeof from === 'number' && Number.isInteger(from) && from >= 1 && from <= n) return from;
  return workoutProgress(view).current?.itemIndex ?? 1;
}

function CloseContent() {
  const { training, health, clock, ready } = useApp();
  use(ready);
  // Read once, when the page opens: minutes do not tick, and a session of another day shows none.
  const [now] = useState(() => clock.now());
  const [today] = useState(() => clock.today());
  const { workoutId = '' } = useParams();
  const state: unknown = useLocation().state;
  const navigate = useNavigate();
  const view = useWorkoutView(training, workoutId as ID);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // While this page closes the workout, the live view turns completed before navigating: show
  // nothing then, rather than "Esta sesión ya está guardada." (plan §6.5).
  const [closing, setClosing] = useState(false);

  if (view === undefined) return null;
  if (view === null || view.workout.status === 'discarded') {
    return (
      <Blocked text={errorMessages['training/workout-not-found']} to="/" link="Volver a Hoy" />
    );
  }
  if (view.workout.status === 'completed') {
    return closing ? null : <Blocked text={CLOSE_TEXTS.saved} to="/" link="Volver a Hoy" />;
  }

  const { workout } = view;
  const backTo = `/sesion/${workout.id}/${String(backIndex(view, state))}`;
  if (!view.sets.some((s) => s.done)) {
    return <Blocked text={CLOSE_TEXTS.nothingDone} to={backTo} link={CLOSE_TEXTS.back} />;
  }

  // AC-18, AC-25, AC-26: pain first, then close; a failure keeps what was chosen for a retry.
  async function save({ level, redFlags, notes }: CloseValues) {
    setSaving(true);
    setError(null);
    setClosing(true);
    try {
      const recorded = await health.recordPain(workout.id, { level, redFlags, date: workout.date });
      if (!recorded.ok) {
        setError(errorMessages[recorded.error.code]);
      } else {
        const finished = await training.finishWorkout(workout.id, { notes });
        if (finished.ok) {
          void navigate('/', { replace: true });
          return;
        }
        // Closed by another tab: the live view already says so (AC-31).
        if (finished.error.code !== 'training/workout-closed') {
          setError(errorMessages[finished.error.code]);
        }
      }
    } catch {
      // Caught here, so the global unhandledrejection notice does not repeat it (ADR-0010).
      setError(GENERIC_ERROR_MESSAGE);
    }
    setSaving(false);
    setClosing(false);
  }

  return (
    <CloseForm
      view={view}
      now={now}
      showTime={workout.date === today}
      backTo={backTo}
      saving={saving}
      error={error}
      onSave={(values) => void save(values)} // the button is disabled while saving (AC-27)
    />
  );
}

function Blocked({ text, to, link }: { text: string; to: string; link: string }) {
  return (
    <>
      <h1>{CLOSE_TEXTS.title}</h1>
      <p>{text}</p>
      <Link to={to} className={pageStyles.backLink}>
        {link}
      </Link>
    </>
  );
}
