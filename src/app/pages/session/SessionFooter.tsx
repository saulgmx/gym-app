import { Link } from 'react-router';
import { formatTarget, type WorkoutView } from '@/modules/training';
import { cx } from '@/shared/ui';
import { formatNextLine } from './format';
import styles from './SessionFooter.module.css';

// The session footer (spec 004 §6.6, AC-31 to AC-34; spec 002 AC-25): what comes next, then
// "Anterior" and "Siguiente" within thumb reach. On the last exercise, with a set done,
// "Terminar sesión" takes the place of "Siguiente" (spec 005 AC-1 to AC-3, plan §6.8).
export function SessionFooter({
  view,
  index,
  path,
  closeTo,
}: {
  view: WorkoutView;
  index: number; // starts at 1
  path: (index: number) => string;
  closeTo: string | null; // the Cierre, or null with no set done
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
        {index < items.length ? (
          <Link to={path(index + 1)} className={cx(styles.step, styles.primary)}>
            Siguiente
          </Link>
        ) : (
          closeTo && (
            <Link to={closeTo} state={{ from: index }} className={cx(styles.step, styles.primary)}>
              Terminar sesión
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
