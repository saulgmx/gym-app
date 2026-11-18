import { useId, useState } from 'react';
import type { WorkoutView } from '../application/ports';
import styles from './SessionHeader.module.css';

interface SessionHeaderProps {
  view: WorkoutView;
  index: number; // starts at 1
  /** Routes belong to app: the header only says which exercise or discard was chosen. */
  onNavigate: (index: number) => void;
  onDiscard: () => void;
}

// Session name, position and the exercise list (docs/modules/training.md §4, SessionHeader).
export function SessionHeader({ view, index, onNavigate, onDiscard }: SessionHeaderProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { workout } = view;

  const rows = workout.items.map((item) => {
    const exercise = view.exercises[item.exerciseId];
    if (!exercise) throw new Error(`Exercise ${item.exerciseId} is not in the view`);
    const sets = view.sets.filter((s) => s.exerciseId === item.exerciseId);
    const done = sets.filter((s) => s.done).length;
    const unit = sets.length === 1 ? 'serie' : 'series';
    const finished = sets.length > 0 && done === sets.length;
    return {
      exerciseId: item.exerciseId,
      name: exercise.name,
      progress: `${String(done)} de ${String(sets.length)} ${unit}${finished ? ' · hecho' : ''}`,
    };
  });

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{workout.name}</h1>
      <p className={styles.position}>
        Ejercicio {index} de {workout.items.length}
      </p>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen(!open);
        }}
      >
        Ver ejercicios
      </button>
      {open && (
        <div id={listId} className={styles.panel}>
          <ol className={styles.list}>
            {rows.map((row, i) => (
              <li key={row.exerciseId}>
                <button
                  type="button"
                  className={styles.row}
                  aria-current={i + 1 === index ? 'step' : undefined}
                  onClick={() => {
                    setOpen(false);
                    onNavigate(i + 1);
                  }}
                >
                  <span className={styles.name}>{row.name}</span>{' '}
                  <span className={styles.progress}>· {row.progress}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className={styles.discard} onClick={onDiscard}>
            Descartar sesión
          </button>
        </div>
      )}
    </header>
  );
}
