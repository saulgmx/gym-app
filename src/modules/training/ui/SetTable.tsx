import { useState } from 'react';
import type { ID } from '@/shared/kernel';
import type { WorkoutView } from '../application/ports';
import type { TrainingApi } from '../application/service';
import type { SetErrorContext, SetField, SetLog, TrainingError } from '../domain/types';
import { formatPrevious, formatRange } from './format';
import { useLastSession } from './hooks';
import { fieldId, SetRow, type RowProblem } from './SetRow';
import styles from './SetTable.module.css';

interface SetTableProps {
  training: TrainingApi;
  view: WorkoutView;
  exerciseId: ID;
  /** Texts come from app (ADR-0010). */
  describeError: (error: TrainingError, context: SetErrorContext) => string;
}

type Problem = RowProblem & { setId: ID | null }; // null: about the table (add or remove)

// The sets of one exercise (docs/modules/training.md §4, SetTable; spec 002 §6).
export function SetTable({ training, view, exerciseId, describeError }: SetTableProps) {
  const exercise = view.exercises[exerciseId];
  const item = view.workout.items.find((i) => i.exerciseId === exerciseId);
  if (!exercise || !item) throw new Error(`Exercise ${exerciseId} is not in the view`);
  const sets = view.sets.filter((s) => s.exerciseId === exerciseId);
  const { metric } = exercise;

  const canAssist = exercise.equipment === 'bodyweight' && metric === 'weight';
  const [assistChoice, setAssistChoice] = useState<boolean | null>(null);
  const assisted =
    canAssist && (assistChoice ?? sets.some((s) => s.weightKg !== null && s.weightKg < 0));
  const last = useLastSession(training, exerciseId, view.workout.date);
  const [problem, setProblem] = useState<Problem | null>(null);

  const fail = (setId: ID | null, field: RowProblem['field'], error: TrainingError) => {
    setProblem({ setId, field, message: describeError(error, { metric, assisted }) });
  };
  const clear = (setId: ID | null) => {
    setProblem((p) => (p?.setId === setId ? null : p));
  };
  const fieldOf = (error: TrainingError, fallback: RowProblem['field']) =>
    error.code === 'training/invalid-set-values' ? error.details.field : fallback;

  async function commit(set: SetLog, field: SetField, value: number | null) {
    const result = await training.logSet(set.id, { [field]: value });
    if (result.ok) {
      clear(set.id);
      return true;
    }
    fail(set.id, fieldOf(result.error, field), result.error);
    return false;
  }

  async function toggle(set: SetLog) {
    const result = await training.toggleSetDone(set.id);
    if (result.ok) {
      clear(set.id);
      return;
    }
    const field = fieldOf(result.error, 'done');
    fail(set.id, field, result.error);
    document.getElementById(fieldId(set, field))?.focus(); // AC-16
  }

  // A change of mode: the weights of the sets not done yet change sign; done sets never do.
  async function switchAssistance(next: boolean) {
    setAssistChoice(next);
    for (const set of sets) {
      if (!set.done && set.weightKg !== null && set.weightKg !== 0) {
        await training.logSet(set.id, { weightKg: -set.weightKg });
      }
    }
  }

  async function add() {
    const result = await training.addExtraSet(view.workout.id, exerciseId);
    if (result.ok) clear(null);
    else fail(null, 'done', result.error);
  }

  const lastSet = sets.at(-1);
  async function remove() {
    if (!lastSet) return;
    const result = await training.removeSet(lastSet.id);
    if (result.ok) clear(null);
    else fail(null, 'done', result.error);
  }

  const full = sets.length >= item.maxSets;
  // Hints of the empty fields and the next set to do (spec 004 AC-27 to AC-30).
  const hints = { reps: formatRange(item.repRange), rir: formatRange(item.targetRir) };
  // The view orders sets by setNumber (RN-TRN-17), as `sets.at(-1)` below relies on too.
  const currentId = sets.find((s) => !s.done)?.id;
  return (
    <div className={styles.wrapper}>
      {canAssist && (
        <label className={styles.assistance}>
          <input
            type="checkbox"
            role="switch"
            checked={assisted}
            onChange={(event) => void switchAssistance(event.target.checked)}
          />
          Con asistencia
        </label>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Serie</th>
            <th scope="col">Anterior</th>
            {metric === 'weight' && <th scope="col">{assisted ? 'Asist. kg' : 'kg'}</th>}
            <th scope="col">{metric === 'time' ? 'Seg' : 'Reps'}</th>
            <th scope="col">RIR</th>
            <th scope="col">
              <span className="visually-hidden">Hecha</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              metric={metric}
              assisted={assisted}
              hints={hints}
              current={set.id === currentId}
              previous={formatPrevious(
                last?.sets.find((s) => s.setNumber === set.setNumber),
                metric,
              )}
              problem={problem?.setId === set.id ? problem : undefined}
              onCommit={(field, value) => commit(set, field, value)}
              onToggle={() => void toggle(set)}
            />
          ))}
        </tbody>
      </table>
      <p className={styles.problem} aria-live="polite">
        {problem?.setId === null ? problem.message : ''}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} disabled={full} onClick={() => void add()}>
          {full ? `Máximo ${String(item.maxSets)} series` : 'Añadir serie'}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={!lastSet || lastSet.done || sets.length <= 1}
          onClick={() => void remove()}
        >
          Quitar serie
        </button>
      </div>
    </div>
  );
}
