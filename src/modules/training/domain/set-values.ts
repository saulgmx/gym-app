import { err, ok, roundToStep, type Result } from '@/shared/kernel';
import type { ExerciseFacts, SetField, SetValueProblem, TrainingError } from './types';

// Values of one set (docs/modules/training.md RN-TRN-04, decision 6). Pure: no I/O.

export interface SetValues {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
}

const WEIGHT_STEP = 0.25;
const MAX_WEIGHT = 500;
const MAX_ASSISTANCE = 100; // bodyweight lifts: down to −100 kg
const MAX_REPS = 100;
const MAX_SECONDS = 600; // metric 'time'
const MAX_RIR = 10;

// Optional sign, digits and at most one decimal separator; the Spanish iOS keypad types a comma.
const NUMBER_TEXT = /^-?(\d+([.,]\d*)?|[.,]\d+)$/;

// -0 is stored as 0.
const normalize = (x: number): number => (x === 0 ? 0 : x);

/** Text of a numeric field: '' → null; anything that is not a number → NaN. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!NUMBER_TEXT.test(trimmed)) return Number.NaN;
  return normalize(Number(trimmed.replace(',', '.')));
}

interface Rule {
  field: SetField;
  required: boolean;
  check: (value: number) => SetValueProblem | undefined;
}

const inRange = (value: number, min: number, max: number) => value >= min && value <= max;

function rules(exercise: ExerciseFacts): Rule[] {
  const assisted = exercise.equipment === 'bodyweight';
  const integerUpTo = (max: number) => (value: number) => {
    if (!inRange(value, 0, max)) return 'out-of-range';
    return Number.isInteger(value) ? undefined : 'step';
  };

  // Column order kg → reps → RIR: the first problem is the field that gets the focus (AC-16).
  return [
    {
      field: 'weightKg',
      required: exercise.metric === 'weight',
      check: (value) => {
        if (exercise.metric !== 'weight') return 'not-allowed';
        if (value < 0 && !assisted) return 'not-allowed';
        if (!inRange(value, assisted ? -MAX_ASSISTANCE : 0, MAX_WEIGHT)) return 'out-of-range';
        return roundToStep(value, WEIGHT_STEP) === value ? undefined : 'step';
      },
    },
    {
      field: 'reps',
      required: true,
      check: integerUpTo(exercise.metric === 'time' ? MAX_SECONDS : MAX_REPS),
    },
    { field: 'rir', required: false, check: integerUpTo(MAX_RIR) },
  ];
}

const invalid = (field: SetField, reason: SetValueProblem): TrainingError => ({
  code: 'training/invalid-set-values',
  message: `Invalid ${field}: ${reason} (RN-TRN-04)`,
  details: { field, reason },
});

/**
 * RN-TRN-04: ranges of the non-null values and, with `forDone`, what marking a set requires.
 * Returns the values normalized, or the first problem in column order.
 */
export function checkSetValues(
  values: SetValues,
  exercise: ExerciseFacts,
  { forDone }: { forDone: boolean },
): Result<SetValues, TrainingError> {
  for (const { field, required, check } of rules(exercise)) {
    const value = values[field];
    if (value === null) {
      if (forDone && required) return err(invalid(field, 'missing'));
      continue;
    }
    if (!Number.isFinite(value)) return err(invalid(field, 'not-a-number'));
    const problem = check(value);
    if (problem) return err(invalid(field, problem));
  }

  const clean = (x: number | null) => (x === null ? null : normalize(x));
  return ok({ weightKg: clean(values.weightKg), reps: clean(values.reps), rir: clean(values.rir) });
}
