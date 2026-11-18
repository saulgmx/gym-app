import { useId, type RefObject } from 'react';
import {
  formatRange,
  formatSetCount,
  formatTarget,
  type WorkoutItem,
  type WorkoutView,
} from '@/modules/training';
import type { ID } from '@/shared/kernel';
import styles from './ExerciseCard.module.css';

interface ExerciseCardProps {
  view: WorkoutView;
  item: WorkoutItem;
  /** Full or compact: the page keeps the choice across exercises (plan §6.5). */
  expanded: boolean;
  onToggle: () => void;
  onChange: (to: ID) => void;
  /** The last error of the page (a change or a discard), visible in both modes. */
  message: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
}

// The exercise card (spec 004 §6.4, AC-20 to AC-25): the name as the page's h1, then either the
// compact line or the details (chips, tip and note, "Cambiar a …"). The details stay in the DOM
// with `hidden`, so the toggle's aria-controls always points to something.
export function ExerciseCard({
  view,
  item,
  expanded,
  onToggle,
  onChange,
  message,
  titleRef,
}: ExerciseCardProps) {
  const detailsId = useId();
  const hintId = useId();
  const exercise = view.exercises[item.exerciseId];
  if (!exercise) throw new Error(`Exercise ${item.exerciseId} is not in the view`);

  const hasDone = view.sets.some((s) => s.exerciseId === item.exerciseId && s.done);
  const alternatives = item.options.filter((id) => id !== item.exerciseId);
  const rir = `RIR ${formatRange(item.targetRir)}`;
  const range = `${formatRange(item.repRange)} ${exercise.metric === 'time' ? 's' : 'reps'}`;

  return (
    <section className={styles.card}>
      <h1 ref={titleRef} tabIndex={-1} className={styles.name} data-expanded={expanded}>
        {exercise.name}
      </h1>
      {!expanded && (
        <p className={styles.line}>{`${formatTarget(item, exercise.metric)} · ${rir}`}</p>
      )}
      <div id={detailsId} className={styles.details} hidden={!expanded}>
        <ul className={styles.chips}>
          <li>{formatSetCount(item.plannedSets)}</li>
          <li>{range}</li>
          <li>{rir}</li>
        </ul>
        {exercise.cue && <p className={styles.tip}>{exercise.cue}</p>}
        {item.note && <p className={styles.note}>{item.note}</p>}
        {alternatives.length > 0 && (
          <div className={styles.change}>
            {alternatives.map((id) => (
              <button
                key={id}
                type="button"
                className={styles.changeButton}
                disabled={hasDone}
                aria-describedby={hasDone ? hintId : undefined}
                onClick={() => {
                  onChange(id);
                }}
              >
                {`Cambiar a ${view.exercises[id]?.name ?? id}`}
              </button>
            ))}
            {hasDone && (
              <p id={hintId} className={styles.hint}>
                Para cambiar de ejercicio, desmarca las series hechas
              </p>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={onToggle}
      >
        {expanded ? 'Ocultar detalles' : 'Ver detalles'}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <p className={styles.problem} aria-live="polite">
        {message}
      </p>
    </section>
  );
}
