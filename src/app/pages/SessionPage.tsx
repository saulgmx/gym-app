import { Suspense, use, useEffect, useId, useRef, useState } from 'react';
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
  const { training, ready } = useApp();
  use(ready);
  const { workoutId = '', exerciseIndex } = useParams();
  const view = useWorkoutView(training, workoutId as ID);
  if (view === undefined) return null;
  if (view?.workout.status !== 'in_progress') return <Unavailable />;

  const index = parseIndex(exerciseIndex, view.workout.items.length);
  if (index === null)
    return <Navigate to={`/sesion/${workoutId}/${String(resumeIndex(view))}`} replace />;
  // Keyed by index: each exercise starts fresh (message, dialog) and focuses its name.
  return <ExerciseScreen key={index} view={view} index={index} />;
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

function ExerciseScreen({ view, index }: { view: WorkoutView; index: number }) {
  const { training } = useApp();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const hintId = useId();

  const { workout } = view;
  const item = workout.items[index - 1];
  const exercise = item && view.exercises[item.exerciseId];
  if (!item || !exercise) throw new Error(`No exercise ${String(index)} in workout ${workout.id}`);
  const { exerciseId } = item;
  const hasDone = view.sets.some((s) => s.exerciseId === exerciseId && s.done);
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

  const [minReps, maxReps] = item.repRange;
  const [minRir, maxRir] = item.targetRir;
  const unit = exercise.metric === 'time' ? ' s' : '';
  const alternatives = item.options.filter((id) => id !== item.exerciseId);

  return (
    <div className={styles.screen}>
      <SessionHeader
        view={view}
        index={index}
        onNavigate={(i) => void navigate(path(i))}
        onDiscard={() => {
          setConfirming(true);
        }}
      />
      <section className={styles.exercise}>
        <h1 ref={title} tabIndex={-1} className={styles.name}>
          {exercise.name}
        </h1>
        <p className={styles.target}>
          {`${String(item.plannedSets)} × ${String(minReps)}-${String(maxReps)}${unit} · RIR ${String(minRir)}-${String(maxRir)}`}
        </p>
        {exercise.cue && <p className={styles.tip}>{exercise.cue}</p>}
        {item.note && <p className={styles.tip}>{item.note}</p>}
        {alternatives.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.change}
            disabled={hasDone}
            aria-describedby={hasDone ? hintId : undefined}
            onClick={() => void change(id)}
          >
            {`Cambiar a ${view.exercises[id]?.name ?? id}`}
          </button>
        ))}
        {hasDone && alternatives.length > 0 && (
          <p id={hintId} className={styles.hint}>
            Para cambiar de ejercicio, desmarca las series hechas
          </p>
        )}
        <p className={styles.problem} aria-live="polite">
          {message}
        </p>
      </section>
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
