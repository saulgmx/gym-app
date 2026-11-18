import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { LocalDate } from '@/shared/kernel';
import { useApp } from '../context';
import { errorMessages } from '../errors/messages';
import styles from './StartWorkoutButton.module.css';

// "Iniciar sesión" for today or another day of the week (spec 002 plan §6.7), shared by
// TodayPage and DayPreviewPage.
export function StartWorkoutButton({
  date,
  plannedFor,
}: {
  date: LocalDate;
  plannedFor: LocalDate;
}) {
  const { training } = useApp();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');

  async function start() {
    setStarting(true);
    const result = await training.startWorkout(date, { plannedFor });
    if (result.ok) {
      void navigate(`/sesion/${result.value.id}/1`);
      return;
    }
    if (result.error.code === 'training/workout-already-active') {
      void navigate(`/sesion/${result.error.details.workoutId}`);
      return;
    }
    setMessage(errorMessages[result.error.code]);
    setStarting(false);
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        disabled={starting}
        onClick={() => void start()}
      >
        Iniciar sesión
      </button>
      <p className={styles.problem} aria-live="polite">
        {message}
      </p>
    </div>
  );
}
