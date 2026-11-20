import { describe, expect, it } from 'vitest';
import type { InvalidSetValuesDetails, SetErrorContext } from '@/modules/training';
import {
  GENERIC_ERROR_MESSAGE,
  describeTrainingError,
  errorMessages,
  setValueMessage,
} from '../messages';

// ADR-0010: every error code has a message (spec 001 plan §6.8, spec 002 plan §6.6).

describe('errorMessages', () => {
  it('los códigos de plan, training y health con sus textos aprobados', () => {
    expect(errorMessages).toEqual({
      'plan/invalid-seed': GENERIC_ERROR_MESSAGE,
      'plan/high-risk-exercise': GENERIC_ERROR_MESSAGE,
      'plan/template-not-found': GENERIC_ERROR_MESSAGE,
      'plan/week-out-of-range': GENERIC_ERROR_MESSAGE,
      'training/workout-not-found': 'Esta sesión ya no está disponible.',
      'training/workout-already-active': 'Ya hay una sesión en curso.',
      'training/workout-closed': 'Esta sesión ya terminó y no se puede cambiar.',
      'training/set-not-found': 'Esta serie ya no existe.',
      'training/invalid-set-values': 'Revisa los valores de la serie.',
      'training/no-plan-today': 'Hoy no toca pesas.',
      'training/planned-date-out-of-week': 'Solo puedes hacer sesiones de esta semana.',
      'training/max-sets-reached': 'Ya tienes el máximo de series de este ejercicio.',
      'training/set-not-removable': 'No puedes quitar una serie hecha ni la única del ejercicio.',
      'training/invalid-exercise-choice': GENERIC_ERROR_MESSAGE,
      'training/item-has-done-sets': 'Para cambiar de ejercicio, desmarca las series hechas.',
      // Spec 005 plan §6.10; pain-required repeats the help of AC-10.
      'training/pain-required': 'Elige el nivel de dolor para poder guardar.',
      'training/nothing-done': 'No hay series hechas para guardar.',
      'training/notes-too-long': 'Las notas pueden tener hasta 2000 caracteres.',
      'training/already-done': 'Ya hiciste esta sesión.',
      // Spec 005b plan §6.5 (RN-TRN-27).
      'training/day-already-trained': 'Ya entrenaste hoy. Podrás empezar otra sesión mañana.',
      // Spec 007 §6.3 (RN-TRN-30): data wraps it; the same text as data/invalid-module-data.
      'training/invalid-backup': 'El respaldo está dañado o incompleto. No se cambió nada.',
      // health (spec 005 plan §6.10): they guard the API, the selector cannot send them.
      'health/pain-out-of-range': 'El dolor va de 0 a 10.',
      'health/invalid-red-flag': 'Revisa las señales de alarma marcadas.',
    });
  });
});

describe('setValueMessage (RN-TRN-04)', () => {
  const weight: SetErrorContext = { metric: 'weight', assisted: false };
  const assisted: SetErrorContext = { metric: 'weight', assisted: true };
  const reps: SetErrorContext = { metric: 'reps', assisted: false };
  const time: SetErrorContext = { metric: 'time', assisted: false };

  const cases: [InvalidSetValuesDetails, SetErrorContext, string][] = [
    [{ field: 'weightKg', reason: 'missing' }, weight, 'Falta el peso.'],
    [{ field: 'reps', reason: 'missing' }, weight, 'Faltan las repeticiones.'],
    [{ field: 'reps', reason: 'missing' }, time, 'Faltan los segundos.'],
    [{ field: 'rir', reason: 'missing' }, weight, 'Falta el RIR.'],
    [{ field: 'weightKg', reason: 'not-a-number' }, weight, 'Escribe un número.'],
    [{ field: 'rir', reason: 'not-a-number' }, weight, 'Escribe un número.'],
    [
      { field: 'weightKg', reason: 'out-of-range' },
      weight,
      'El peso va de 0 a 500 kg, en pasos de 0,25.',
    ],
    [{ field: 'weightKg', reason: 'step' }, weight, 'El peso va de 0 a 500 kg, en pasos de 0,25.'],
    [
      { field: 'weightKg', reason: 'out-of-range' },
      assisted,
      'La asistencia va de 0 a 100 kg, en pasos de 0,25.',
    ],
    [
      { field: 'weightKg', reason: 'step' },
      assisted,
      'La asistencia va de 0 a 100 kg, en pasos de 0,25.',
    ],
    [{ field: 'reps', reason: 'out-of-range' }, reps, 'Las repeticiones van de 0 a 100.'],
    [{ field: 'reps', reason: 'out-of-range' }, time, 'Los segundos van de 0 a 600.'],
    [{ field: 'rir', reason: 'out-of-range' }, time, 'El RIR va de 0 a 10.'],
    [{ field: 'reps', reason: 'step' }, weight, 'Las repeticiones van en números enteros.'],
    [{ field: 'reps', reason: 'step' }, time, 'Los segundos van en números enteros.'],
    [{ field: 'rir', reason: 'step' }, weight, 'El RIR va en números enteros.'],
    [{ field: 'weightKg', reason: 'not-allowed' }, reps, 'Este ejercicio no lleva peso.'],
    [{ field: 'weightKg', reason: 'not-allowed' }, time, 'Este ejercicio no lleva peso.'],
    [{ field: 'weightKg', reason: 'not-allowed' }, weight, 'El peso no puede ser negativo.'],
  ];

  it.each(cases)('%o con %o → %s', (details, context, text) => {
    expect(setValueMessage(details, context)).toBe(text);
  });
});

describe('describeTrainingError', () => {
  const context: SetErrorContext = { metric: 'time', assisted: false };

  it('invalid-set-values → el detalle de su campo', () => {
    expect(
      describeTrainingError(
        {
          code: 'training/invalid-set-values',
          message: '',
          details: { field: 'reps', reason: 'missing' },
        },
        context,
      ),
    ).toBe('Faltan los segundos.');
  });

  it('otro código → su texto', () => {
    expect(describeTrainingError({ code: 'training/max-sets-reached', message: '' }, context)).toBe(
      'Ya tienes el máximo de series de este ejercicio.',
    );
  });
});
