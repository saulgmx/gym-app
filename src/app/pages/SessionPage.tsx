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
import { useApp } from '../context';
import { describeTrainingError, errorMessages } from '../errors/messages';
import { Elapsed } from './Elapsed';
import { formatElapsed } from '../format-time';
import { CLOSE_TEXTS } from './close/format';
import { ExerciseCard } from './session/ExerciseCard';
import { ExitSheet } from './session/ExitSheet';
import { SessionFooter } from './session/SessionFooter';
import { formatExitSummary } from './session/format';
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
  if (view?.workout.status !== 'in_progress') {
    return <Unavailable saved={view?.workout.status === 'completed'} />;
  }

  const index = parseIndex(exerciseIndex, view.workout.items.length);
  if (index === null)
    return <Navigate to={`/sesion/${workoutId}/${String(resumeIndex(view))}`} replace />;
  const { workout } = view;
  const sameDay = workout.date === today;
  const elapsed = sameDay ? <Elapsed startedAt={workout.startedAt} clock={clock} /> : null;
  // Keyed by index: each exercise starts fresh (message, dialog) and focuses its name.
  return (
    <ExerciseScreen
      key={index}
      view={view}
      index={index}
      elapsed={elapsed}
      sameDay={sameDay}
      expanded={expanded}
      onToggleDetails={() => {
        setExpanded(!expanded);
      }}
    />
  );
}

// A closed session says it was saved (spec 005 AC-28); a discarded or missing one, unavailable.
function Unavailable({ saved }: { saved: boolean }) {
  return (
    <>
      <h1>Sesión</h1>
      <p>{saved ? CLOSE_TEXTS.saved : errorMessages['training/workout-not-found']}</p>
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
  sameDay,
  expanded,
  onToggleDetails,
}: {
  view: WorkoutView;
  index: number;
  elapsed: ReactNode;
  /** The session is from the day the page opened: the exit text then carries the time. */
  sameDay: boolean;
  expanded: boolean;
  onToggleDetails: () => void;
}) {
  const { training, clock } = useApp();
  const navigate = useNavigate();
  // The exit sheet and the text it shows, computed when it opens (spec 004 §6.3).
  const [exitSummary, setExitSummary] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const title = useRef<HTMLHeadingElement>(null);

  const { workout } = view;
  const item = workout.items[index - 1];
  const exercise = item && view.exercises[item.exerciseId];
  if (!item || !exercise) throw new Error(`No exercise ${String(index)} in workout ${workout.id}`);
  const { exerciseId } = item;
  const path = (i: number) => `/sesion/${workout.id}/${String(i)}`;
  // Spec 005 AC-1 to AC-6: the Cierre only once there is something to save (extras count).
  const closeTo = workoutProgress(view).setsDone > 0 ? `/sesion/${workout.id}/cierre` : null;

  // A new exercise starts at the top, with focus on its name for screen readers.
  useEffect(() => {
    title.current?.focus();
  }, []);

  async function change(to: ID) {
    const result = await training.chooseExercise(workout.id, exerciseId, to);
    setMessage(result.ok ? '' : errorMessages[result.error.code]);
  }

  function openExit() {
    const progress = workoutProgress(view);
    const seconds = (Date.parse(clock.now()) - Date.parse(workout.startedAt)) / 1000;
    const time = sameDay ? formatElapsed(seconds) : null;
    setExitSummary(formatExitSummary(progress.itemsDone, progress.itemCount, time));
  }

  async function discard() {
    setExitSummary(null);
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
        onExit={openExit}
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
      <SessionFooter view={view} index={index} path={path} closeTo={closeTo} />
      <ExitSheet
        open={exitSummary !== null}
        summary={exitSummary ?? ''}
        counts={workoutProgress(view)}
        onClose={() => {
          setExitSummary(null);
        }}
        onDiscard={() => void discard()}
        finishTo={closeTo === null ? null : { path: closeTo, from: index }}
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
