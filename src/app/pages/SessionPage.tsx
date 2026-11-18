import { Suspense, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import {
  SessionHeader,
  SetTable,
  useWorkoutView,
  workoutProgress,
  type WorkoutView,
} from '@/modules/training';
import type { ID } from '@/shared/kernel';
import { ConfirmDialog, cx } from '@/shared/ui';
import { useApp } from '../context';
import { describeTrainingError, errorMessages } from '../errors/messages';
import { discardDialogText } from './discard-dialog';
import { Elapsed } from './Elapsed';
import { ExerciseCard } from './session/ExerciseCard';
import styles from './SessionPage.module.css';
import pageStyles from './pages.module.css';

// The active session, one exercise at a time (spec 002 §6, AC-22 to AC-28; plan §6.7).
export function SessionPage() {
  return (
    <main className={pageStyles.fullScreen}>
      <title>Sesión · Gym</title>
      <Suspense fallback={null}>
        <SessionContent />
      </Suspense>
    </main>
  );
}

/** 1-based index from the URL, or null if it is not an integer from 1 to n. */
function parseIndex(text: string | undefined, n: number): number | null {
  if (!text || !/^\d+$/.test(text)) return null;
  const index = Number(text);
  return index >= 1 && index <= n ? index : null;
}

/** The current exercise of RN-TRN-21 ("Vas en" in Hoy), or the last one (AC-4, AC-27). */
function resumeIndex(view: WorkoutView): number {
  return workoutProgress(view).current?.itemIndex ?? view.workout.items.length;
}

function SessionContent() {
  const { training, clock, ready } = useApp();
  use(ready);
  // "Today" is read once, when the page opens: a session of another day shows no time, and
  // midnight does not change that until the page opens again (spec 004 §8, decision 9).
  const [today] = useState(() => clock.today());
  // Compact or full card: kept across exercises, which remount, and lost on reload (plan §6.5).
  const [expanded, setExpanded] = useState(false);
  const { workoutId = '', exerciseIndex } = useParams();
  const view = useWorkoutView(training, workoutId as ID);
  if (view === undefined) return null;
  if (view?.workout.status !== 'in_progress') return <Unavailable />;

  const index = parseIndex(exerciseIndex, view.workout.items.length);
  if (index === null)
    return <Navigate to={`/sesion/${workoutId}/${String(resumeIndex(view))}`} replace />;
  const { workout } = view;
  const elapsed =
    workout.date === today ? <Elapsed startedAt={workout.startedAt} clock={clock} /> : null;
  // Keyed by index: each exercise starts fresh (message, dialog) and focuses its name.
  return (
    <ExerciseScreen
      key={index}
      view={view}
      index={index}
      elapsed={elapsed}
      expanded={expanded}
      onToggleDetails={() => {
        setExpanded(!expanded);
      }}
    />
  );
}

function Unavailable() {
  return (
    <>
      <h1>Sesión</h1>
      <p>{errorMessages['training/workout-not-found']}</p>
      <Link to="/" className={pageStyles.backLink}>
        Volver a Hoy
      </Link>
    </>
  );
}

function ExerciseScreen({
  view,
  index,
  elapsed,
  expanded,
  onToggleDetails,
}: {
  view: WorkoutView;
  index: number;
  elapsed: ReactNode;
  expanded: boolean;
  onToggleDetails: () => void;
}) {
  const { training } = useApp();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const title = useRef<HTMLHeadingElement>(null);

  const { workout } = view;
  const item = workout.items[index - 1];
  const exercise = item && view.exercises[item.exerciseId];
  if (!item || !exercise) throw new Error(`No exercise ${String(index)} in workout ${workout.id}`);
  const { exerciseId } = item;
  const path = (i: number) => `/sesion/${workout.id}/${String(i)}`;

  // A new exercise starts at the top, with focus on its name for screen readers.
  useEffect(() => {
    title.current?.focus();
  }, []);

  async function change(to: ID) {
    const result = await training.chooseExercise(workout.id, exerciseId, to);
    setMessage(result.ok ? '' : errorMessages[result.error.code]);
  }

  async function discard() {
    setConfirming(false);
    const result = await training.discardWorkout(workout.id);
    if (result.ok) void navigate('/', { replace: true });
    else setMessage(errorMessages[result.error.code]);
  }

  return (
    <div className={styles.screen}>
      <SessionHeader
        view={view}
        index={index}
        elapsed={elapsed && <TimeLabel>{elapsed}</TimeLabel>}
        onNavigate={(i) => void navigate(path(i))}
        // Until the exit sheet comes (spec 004 T10), the arrow opens the discard confirmation,
        // so discarding stays reachable once the menu no longer has it.
        onExit={() => {
          setConfirming(true);
        }}
      />
      <ExerciseCard
        view={view}
        item={item}
        expanded={expanded}
        onToggle={onToggleDetails}
        onChange={(to) => void change(to)}
        message={message}
        titleRef={title}
      />
      <SetTable
        key={item.exerciseId}
        training={training}
        view={view}
        exerciseId={item.exerciseId}
        describeError={describeTrainingError}
      />
      <nav aria-label="Ejercicios" className={styles.footer}>
        {index > 1 && (
          <Link to={path(index - 1)} className={styles.step}>
            Anterior
          </Link>
        )}
        {index < workout.items.length && (
          <Link to={path(index + 1)} className={cx(styles.step, styles.next)}>
            Siguiente
          </Link>
        )}
      </nav>
      <ConfirmDialog
        open={confirming}
        {...discardDialogText(workoutProgress(view))}
        destructive
        onConfirm={() => void discard()}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </div>
  );
}

/** The time with its name for screen readers ("Tiempo de sesión 18:42", spec 004 AC-2). */
function TimeLabel({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="visually-hidden">Tiempo de sesión </span>
      {children}
    </>
  );
}
