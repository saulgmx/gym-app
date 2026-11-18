import { useState } from 'react';
import { cx } from '@/shared/ui';
import { parseNumber } from '../domain/set-values';
import type { ExerciseFacts, SetField, SetLog } from '../domain/types';
import { formatNumber } from './format';
import styles from './SetTable.module.css';

export interface RowProblem {
  field: SetField | 'done';
  message: string;
}

interface SetRowProps {
  set: SetLog;
  metric: ExerciseFacts['metric'];
  assisted: boolean;
  /** Placeholders: the planned ranges of reps (or seconds) and RIR. Not values. */
  hints: { reps: string; rir: string };
  /** The first set not done yet: a visual cue only (spec 004 §6.5). */
  current: boolean;
  previous: string;
  problem: RowProblem | undefined;
  /** Saves one field; resolves false when it was rejected (the field keeps what was typed). */
  onCommit: (field: SetField, value: number | null) => Promise<boolean>;
  onToggle: () => void;
}

/** ID of a field, so the table can move the focus to it after an error (AC-16). */
export const fieldId = (set: SetLog, field: SetField | 'done') => `set-${set.id}-${field}`;

// One set of the table (docs/modules/training.md §4, SetTable).
export function SetRow({
  set,
  metric,
  assisted,
  hints,
  current,
  previous,
  problem,
  onCommit,
  onToggle,
}: SetRowProps) {
  const n = String(set.setNumber);
  const errorId = `set-${set.id}-error`;
  const invalid = (field: SetField | 'done') => problem?.field === field;
  // With assistance on, the weight field shows −weight and saves −typed (−20 reads as 20).
  // Reps and RIR never change sign, neither shown nor saved.
  const flip = (field: SetField, n: number | null) =>
    n === null || field !== 'weightKg' || !assisted ? n : -n;

  const cell = (
    field: SetField,
    label: string,
    value: number | null,
    decimal: boolean,
    placeholder?: string,
  ) => (
    <td>
      <NumberField
        id={fieldId(set, field)}
        label={label}
        {...(placeholder === undefined ? {} : { placeholder })}
        value={flip(field, value)}
        decimal={decimal}
        invalid={invalid(field)}
        errorId={errorId}
        onCommit={(typed) => onCommit(field, flip(field, typed))}
      />
    </td>
  );

  return (
    <>
      <tr className={cx(set.done && styles.done)} data-current={current || undefined}>
        <th scope="row" className={styles.number}>
          {n}
          {set.isExtra && <span className={styles.extra}>extra</span>}
        </th>
        <td className={styles.previous}>{previous}</td>
        {metric === 'weight' &&
          cell(
            'weightKg',
            `Serie ${n}, ${assisted ? 'asistencia en kilos' : 'kilos'}`,
            set.weightKg,
            true,
          )}
        {cell(
          'reps',
          `Serie ${n}, ${metric === 'time' ? 'segundos' : 'repeticiones'}`,
          set.reps,
          false,
          hints.reps,
        )}
        {cell('rir', `Serie ${n}, RIR`, set.rir, false, hints.rir)}
        <td>
          <label className={styles.check}>
            <input
              id={fieldId(set, 'done')}
              type="checkbox"
              aria-label={`Serie ${n} hecha`}
              aria-invalid={invalid('done') || undefined}
              aria-describedby={problem ? errorId : undefined}
              checked={set.done}
              onChange={onToggle}
            />
          </label>
        </td>
      </tr>
      <tr className={styles.problemRow}>
        <td colSpan={metric === 'weight' ? 6 : 5}>
          <p id={errorId} className={styles.problem} aria-live="polite">
            {problem?.message}
          </p>
        </td>
      </tr>
    </>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number | null;
  decimal: boolean;
  placeholder?: string;
  invalid: boolean;
  errorId: string;
  onCommit: (value: number | null) => Promise<boolean>;
}

// Keeps what was typed while it has the focus, was rejected or is still on its way to the
// stored value (useLiveQuery answers after the write); otherwise shows what is stored, so a
// change from another tab or the inherited weight appears on its own.
function NumberField({
  id,
  label,
  value,
  decimal,
  placeholder,
  invalid,
  errorId,
  onCommit,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // Any change of the stored value ends the wait (React: adjust state when a prop changes).
  const [lastValue, setLastValue] = useState(value);
  if (!Object.is(value, lastValue)) {
    setLastValue(value);
    setWaiting(false);
  }

  const stored = value === null ? '' : formatNumber(value);
  const shown = draft !== null && (focused || rejected || waiting) ? draft : stored;

  async function commit() {
    setFocused(false);
    if (draft === null || draft.trim() === stored) {
      setDraft(null);
      return;
    }
    const saved = await onCommit(parseNumber(draft));
    setRejected(!saved);
    setWaiting(saved);
  }

  return (
    <input
      id={id}
      className={styles.field}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      aria-label={label}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      value={shown}
      onFocus={() => {
        setDraft(shown);
        setFocused(true);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}
