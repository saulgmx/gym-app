import { useId, useState } from 'react';
import { Link } from 'react-router';
import { workoutProgress, type WorkoutView } from '@/modules/training';
import type { LocalDate } from '@/shared/kernel';
import { ConfirmDialog, cx } from '@/shared/ui';
import { useApp } from '../../context';
import { errorMessages } from '../../errors/messages';
import { formatLongDate } from '../../format-date';
import { discardDialogText } from '../discard-dialog';
import { Elapsed } from '../Elapsed';
import { formatCurrent, formatItemsDone, formatRemaining } from './format';
import styles from './ActiveSessionCard.module.css';

// "Sesión en curso" (spec 003 §6.3, AC-16 to AC-25): it takes the place of the day card. The
// progress comes from training (RN-TRN-20 and 21) and updates live with the view. The eyebrow
// names the region, so the elapsed time sits next to it, never inside the name.
export function ActiveSessionCard({ view, today }: { view: WorkoutView; today: LocalDate }) {
  const { training, clock } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const eyebrowId = useId();

  const { workout } = view;
  const progress = workoutProgress(view);
  const { current } = progress;
  const currentName = current && view.exercises[current.exerciseId]?.name;
  const isToday = workout.date === today;

  async function discard() {
    setConfirming(false);
    const result = await training.discardWorkout(workout.id);
    setMessage(result.ok ? '' : errorMessages[result.error.code]);
  }

  return (
    <section className={styles.card} aria-labelledby={eyebrowId}>
      <div className={styles.top}>
        <p className={styles.eyebrow}>
          <span aria-hidden="true" className={styles.dot} />
          <span id={eyebrowId}>Sesión en curso</span>
        </p>
        {/* Only for a session of today (AC-19); not a live region. */}
        {isToday && (
          <p className={styles.elapsed}>
            <span className="visually-hidden">Tiempo transcurrido: </span>
            <Elapsed startedAt={workout.startedAt} clock={clock} />
          </p>
        )}
      </div>
      <h2 className={styles.title}>{workout.name}</h2>
      <p className={styles.progress}>
        <span>{formatItemsDone(progress.itemsDone, progress.itemCount)}</span>
        {progress.remainingSeconds !== null && (
          <span>{formatRemaining(progress.remainingSeconds)}</span>
        )}
      </p>
      {/* Decorative: the text above already says it (spec 003 §6.3). */}
      <div aria-hidden="true" className={styles.segments}>
        {progress.items.map((state, i) => (
          <span key={i} data-state={state} className={cx(styles.segment, styles[state])} />
        ))}
      </div>
      {current && currentName && (
        <p className={styles.position}>{formatCurrent(currentName, current.setNumber)}</p>
      )}
      <Link
        to={
          current ? `/sesion/${workout.id}/${String(current.itemIndex)}` : `/sesion/${workout.id}`
        }
        className={styles.primary}
      >
        {isToday ? 'Continuar sesión' : `Continuar sesión del ${formatLongDate(workout.date)}`}
      </Link>
      <button
        type="button"
        className={styles.secondary}
        onClick={() => {
          setConfirming(true);
        }}
      >
        Descartar sesión
      </button>
      <p className={styles.problem} aria-live="polite">
        {message}
      </p>
      <ConfirmDialog
        open={confirming}
        {...discardDialogText(progress)}
        destructive
        onConfirm={() => void discard()}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </section>
  );
}
