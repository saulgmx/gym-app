import { useId, useState } from 'react';
import { PainSelector, RedFlagsChecklist, type RedFlag } from '@/modules/health';
import type { WorkoutView } from '@/modules/training';
import type { Instant } from '@/shared/kernel';
import { formatLongDateTitle } from '../../format-date';
import { CloseFooter } from './CloseFooter';
import { CloseSummary } from './CloseSummary';
import { CLOSE_TEXTS } from './format';
import styles from './close.module.css';

export interface CloseValues {
  level: number;
  redFlags: RedFlag[];
  notes: string;
}

// The Cierre form (spec 005 §6.1, AC-7 to AC-17). What is chosen lives here and is never stored
// until "Guardar sesión" (spec §6.1); saving itself belongs to ClosePage, which stays mounted.
export function CloseForm({
  view,
  now,
  showTime,
  backTo,
  saving,
  error,
  onSave,
}: {
  view: WorkoutView;
  now: Instant;
  showTime: boolean;
  backTo: string;
  saving: boolean;
  error: string | null;
  onSave: (values: CloseValues) => void;
}) {
  const [level, setLevel] = useState<number | null>(null);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [notes, setNotes] = useState('');
  const notesId = useId();
  const { workout } = view;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.check}>
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1>{CLOSE_TEXTS.done}</h1>
        <p className={styles.subtitle}>
          {formatLongDateTitle(workout.date)} · {workout.name}
        </p>
      </header>
      <CloseSummary view={view} now={now} showTime={showTime} />
      <PainSelector value={level} onChange={setLevel} />
      <RedFlagsChecklist value={redFlags} onChange={setRedFlags} />
      <div className={styles.notes}>
        <label htmlFor={notesId}>{CLOSE_TEXTS.notes}</label>
        <textarea
          id={notesId}
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
      </div>
      <CloseFooter
        canSave={level !== null}
        saving={saving}
        error={error}
        backTo={backTo}
        onSave={() => {
          if (level !== null) onSave({ level, redFlags, notes });
        }}
      />
    </div>
  );
}
