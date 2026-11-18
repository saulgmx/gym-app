import type { PlanErrorCode } from '@/modules/plan';
import type {
  InvalidSetValuesDetails,
  SetErrorContext,
  TrainingError,
  TrainingErrorCode,
} from '@/modules/training';

// User-facing error texts (ADR-0010). Only app maps error codes to Spanish messages.

/** Generic text for unexpected errors (spec 000 §6). */
export const GENERIC_ERROR_MESSAGE =
  'Algo salió mal. Tus datos guardados no se han perdido. Recarga la app para continuar.';

/** Union of every module's error codes. */
export type ErrorCode = PlanErrorCode | TrainingErrorCode;

/** Adding a code to ErrorCode without its message here breaks tsc. */
export const errorMessages: Record<ErrorCode, string> = {
  // Phase 1: none of these is a user mistake, so all use the generic text (spec 001 plan §6.8).
  'plan/invalid-seed': GENERIC_ERROR_MESSAGE,
  'plan/high-risk-exercise': GENERIC_ERROR_MESSAGE,
  'plan/template-not-found': GENERIC_ERROR_MESSAGE,
  'plan/week-out-of-range': GENERIC_ERROR_MESSAGE,
  // Phase 2 (spec 002 plan §6.6).
  'training/workout-not-found': 'Esta sesión ya no está disponible.',
  'training/workout-already-active': 'Ya hay una sesión en curso.',
  'training/workout-closed': 'Esta sesión ya terminó y no se puede cambiar.',
  'training/set-not-found': 'Esta serie ya no existe.',
  'training/invalid-set-values': 'Revisa los valores de la serie.',
  'training/no-plan-today': 'Hoy no toca pesas.',
  'training/planned-date-out-of-week': 'Solo puedes hacer sesiones de esta semana.',
  'training/max-sets-reached': 'Ya tienes el máximo de series de este ejercicio.',
  'training/set-not-removable': 'No puedes quitar una serie hecha ni la única del ejercicio.',
  'training/invalid-exercise-choice': GENERIC_ERROR_MESSAGE, // a bug, not a user mistake
  'training/item-has-done-sets': 'Para cambiar de ejercicio, desmarca las series hechas.',
};

// The detail of invalid-set-values, by field and reason (RN-TRN-04). Decimal comma, as typed.
export function setValueMessage(
  { field, reason }: InvalidSetValuesDetails,
  { metric, assisted }: SetErrorContext,
): string {
  if (reason === 'not-a-number') return 'Escribe un número.';
  const seconds = metric === 'time';

  if (field === 'weightKg') {
    if (reason === 'missing') return 'Falta el peso.';
    if (reason === 'not-allowed') {
      return metric === 'weight'
        ? 'El peso no puede ser negativo.'
        : 'Este ejercicio no lleva peso.';
    }
    return assisted
      ? 'La asistencia va de 0 a 100 kg, en pasos de 0,25.'
      : 'El peso va de 0 a 500 kg, en pasos de 0,25.';
  }

  const [name, missing, range] =
    field === 'rir'
      ? ['El RIR va', 'Falta el RIR.', 'El RIR va de 0 a 10.']
      : seconds
        ? ['Los segundos van', 'Faltan los segundos.', 'Los segundos van de 0 a 600.']
        : ['Las repeticiones van', 'Faltan las repeticiones.', 'Las repeticiones van de 0 a 100.'];
  if (reason === 'missing') return missing;
  if (reason === 'step') return `${name} en números enteros.`;
  return range; // out-of-range; 'not-allowed' only applies to the weight
}

/** Text for a training error; invalid-set-values gets its field detail. */
export function describeTrainingError(error: TrainingError, context: SetErrorContext): string {
  return error.code === 'training/invalid-set-values'
    ? setValueMessage(error.details, context)
    : errorMessages[error.code];
}
