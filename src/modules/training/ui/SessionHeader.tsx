import { useId, useRef, useState, type ReactNode } from 'react';
import { cx, Dialog } from '@/shared/ui';
import type { WorkoutView } from '../application/ports';
import { workoutProgress } from '../application/progress';
import { formatSetCount, formatTarget } from './format';
import styles from './SessionHeader.module.css';

interface SessionHeaderProps {
  view: WorkoutView;
  index: number; // starts at 1
  /** The elapsed time comes from app, which owns the clock; null hides it. */
  elapsed: ReactNode;
  /** Routes and the exit sheet belong to app: the header only says what was chosen. */
  onNavigate: (index: number) => void;
  onExit: () => void;
}

type State = 'done' | 'current' | 'pending';

// Hidden words that put the state in each row's accessible name; "En curso" is already visible.
const STATE_TEXT: Record<State, string> = {
  done: ', hecho,',
  current: ',',
  pending: ', pendiente,',
};

// One row with the exit, the exercise menu and the time (docs/modules/training.md §4,
// SessionHeader; spec 004 §6.1 and §6.2). The page's h1 is the exercise, so nothing here is a
// heading until the menu opens.
export function SessionHeader({ view, index, elapsed, onNavigate, onExit }: SessionHeaderProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const summaryId = useId();
  const viewed = useRef<HTMLButtonElement>(null);
  const { workout } = view;
  const progress = workoutProgress(view);

  const rows = workout.items.map((item, i) => {
    const exercise = view.exercises[item.exerciseId];
    if (!exercise) throw new Error(`Exercise ${item.exerciseId} is not in the view`);
    const sets = view.sets.filter((s) => s.exerciseId === item.exerciseId);
    const done = sets.filter((s) => s.done).length;
    const state: State = progress.items[i] ?? 'pending';
    const count = `${String(done)} de ${formatSetCount(sets.length)}`;
    let detail: string;
    if (state === 'current') detail = `En curso · serie ${String(progress.current?.setNumber)}`;
    else if (state === 'done' || done > 0) detail = count;
    else detail = formatTarget(item, exercise.metric);
    return { exerciseId: item.exerciseId, name: exercise.name, state, detail };
  });

  const summary = `${String(progress.itemsDone)} de ${String(progress.itemCount)} hechos${
    progress.current ? ' · 1 en curso' : ''
  }`;

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.exit}
        aria-label="Salir de la sesión"
        onClick={onExit}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        Ejercicio {index} de {workout.items.length}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {elapsed !== null && <span className={styles.elapsed}>{elapsed}</span>}
      <Dialog
        open={open}
        placement="top"
        dismissOnBackdrop
        labelledBy={titleId}
        describedBy={summaryId}
        initialFocus={viewed}
        onClose={() => {
          setOpen(false);
        }}
      >
        <h2 id={titleId} className={styles.menuTitle}>
          {workout.name}
        </h2>
        <p id={summaryId} className={styles.summary}>
          {summary}
        </p>
        <ol className={styles.list}>
          {rows.map((row, i) => (
            <li key={row.exerciseId}>
              <button
                ref={i + 1 === index ? viewed : undefined}
                type="button"
                className={styles.row}
                data-state={row.state}
                aria-current={i + 1 === index ? 'step' : undefined}
                onClick={() => {
                  setOpen(false);
                  onNavigate(i + 1);
                }}
              >
                <span aria-hidden="true" className={cx(styles.mark, styles[row.state])}>
                  {row.state === 'done' ? '✓' : i + 1}
                </span>
                <span className={styles.text}>
                  <span className={styles.name}>{row.name}</span>
                  <span className="visually-hidden">{STATE_TEXT[row.state]}</span>{' '}
                  <span className={styles.detail}>{row.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Dialog>
    </header>
  );
}
