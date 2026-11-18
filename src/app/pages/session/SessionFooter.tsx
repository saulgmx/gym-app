import { Link } from 'react-router';
import { formatTarget, type WorkoutView } from '@/modules/training';
import { cx } from '@/shared/ui';
import { formatNextLine } from './format';
import styles from './SessionFooter.module.css';

// The session footer (spec 004 §6.6, AC-31 to AC-34; spec 002 AC-25): what comes next, then
// "Anterior" and "Siguiente" within thumb reach. No "Terminar sesión" until spec 005.
export function SessionFooter({
  view,
  index,
  path,
}: {
  view: WorkoutView;
  index: number; // starts at 1
  path: (index: number) => string;
}) {
  const { items } = view.workout;
  const nextItem = items[index]; // index is 1-based, so this is the one after
  const nextExercise = nextItem && view.exercises[nextItem.exerciseId];
  const next =
    nextItem && nextExercise
      ? { name: nextExercise.name, target: formatTarget(nextItem, nextExercise.metric) }
      : null;

  return (
    <nav aria-label="Ejercicios" className={styles.footer}>
      <p className={styles.next}>{formatNextLine(next)}</p>
      <div className={styles.steps}>
        {index > 1 && (
          <Link to={path(index - 1)} className={styles.step}>
            Anterior
          </Link>
        )}
        {index < items.length && (
          <Link to={path(index + 1)} className={cx(styles.step, styles.primary)}>
            Siguiente
          </Link>
        )}
      </div>
    </nav>
  );
}
