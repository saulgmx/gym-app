import { describe, expect, it } from 'vitest';
import type { ID } from '@/shared/kernel';
import { checkSetValues, parseNumber, type SetValues } from '../domain/set-values';
import type { ExerciseFacts, SetField, SetValueProblem } from '../domain/types';

// RN-TRN-04 (contract v1.4, decision 6): values of one set, by metric and equipment.

const exercise = (metric: ExerciseFacts['metric'], equipment = 'machine'): ExerciseFacts => ({
  id: 'ex' as ID,
  metric,
  equipment,
});
const prensa = exercise('weight'); // machine, weight
const dominadas = exercise('weight', 'bodyweight'); // assistance allowed
const deadBug = exercise('reps', 'bodyweight');
const plancha = exercise('time', 'bodyweight');

const values = (v: Partial<SetValues> = {}): SetValues => ({
  weightKg: null,
  reps: null,
  rir: null,
  ...v,
});

function expectProblem(
  v: Partial<SetValues>,
  ex: ExerciseFacts,
  field: SetField,
  reason: SetValueProblem,
  forDone = false,
) {
  const result = checkSetValues(values(v), ex, { forDone });
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error).toMatchObject({
    code: 'training/invalid-set-values',
    details: { field, reason },
  });
  expect(result.error.message).toMatch(/RN-TRN-04/);
}

const expectOk = (v: Partial<SetValues>, ex: ExerciseFacts, forDone = false) => {
  expect(checkSetValues(values(v), ex, { forDone })).toEqual({ ok: true, value: values(v) });
};

describe('parseNumber', () => {
  it('RN-TRN-04: acepta coma o punto decimal y espacios alrededor', () => {
    expect(parseNumber('62,5')).toBe(62.5);
    expect(parseNumber('62.5')).toBe(62.5);
    expect(parseNumber(' 60 ')).toBe(60);
    expect(parseNumber('60.')).toBe(60);
    expect(parseNumber(',5')).toBe(0.5);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('-20')).toBe(-20);
    expect(parseNumber('0')).toBe(0);
  });

  it('RN-TRN-04: "-0" se lee como 0', () => {
    expect(Object.is(parseNumber('-0'), 0)).toBe(true);
  });

  it('RN-TRN-04: vacío o solo espacios → null', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
  });

  it('RN-TRN-04: cualquier otro texto → NaN', () => {
    for (const text of [
      'abc',
      '1e2',
      '1.234,5',
      '1,2,3',
      '--5',
      '+5',
      '.',
      '-',
      '6 0',
      'Infinity',
    ]) {
      expect(parseNumber(text), text).toBeNaN();
    }
  });
});

describe('checkSetValues', () => {
  describe('RN-TRN-04: obligatorios para marcar', () => {
    it('peso y reps completos, RIR opcional → ok', () => {
      expectOk({ weightKg: 60, reps: 10, rir: 2 }, prensa, true);
      expectOk({ weightKg: 60, reps: 10 }, prensa, true);
    });

    it('sin peso en un ejercicio con peso → missing en weightKg', () => {
      expectProblem({ reps: 10 }, prensa, 'weightKg', 'missing', true);
    });

    it('sin reps → missing en reps', () => {
      expectProblem({ weightKg: 60 }, prensa, 'reps', 'missing', true);
      expectProblem({}, deadBug, 'reps', 'missing', true);
      expectProblem({}, plancha, 'reps', 'missing', true);
    });

    it('al registrar sin marcar, lo que falta no es error', () => {
      expectOk({}, prensa);
      expectOk({ weightKg: 60 }, prensa);
      expectOk({ rir: 2 }, prensa);
    });

    it('en reps y time solo hacen falta las reps', () => {
      expectOk({ reps: 10 }, deadBug, true);
      expectOk({ reps: 40 }, plancha, true);
    });
  });

  describe('RN-TRN-04: límites', () => {
    it('peso de 0 a 500; 0 es peso corporal sin lastre', () => {
      expectOk({ weightKg: 0 }, prensa);
      expectOk({ weightKg: 0, reps: 8 }, dominadas, true);
      expectOk({ weightKg: 500 }, prensa);
      expectProblem({ weightKg: 500.25 }, prensa, 'weightKg', 'out-of-range');
    });

    it('reps de 0 a 100; segundos de 0 a 600 en time', () => {
      expectOk({ reps: 0 }, prensa);
      expectOk({ reps: 100 }, prensa);
      expectProblem({ reps: 101 }, prensa, 'reps', 'out-of-range');
      expectProblem({ reps: -1 }, prensa, 'reps', 'out-of-range');
      expectOk({ reps: 600 }, plancha);
      expectProblem({ reps: 601 }, plancha, 'reps', 'out-of-range');
      expectProblem({ reps: 101 }, deadBug, 'reps', 'out-of-range');
    });

    it('RIR de 0 a 10', () => {
      expectOk({ rir: 0 }, prensa);
      expectOk({ rir: 10 }, prensa);
      expectProblem({ rir: 11 }, prensa, 'rir', 'out-of-range');
      expectProblem({ rir: -1 }, prensa, 'rir', 'out-of-range');
    });
  });

  describe('RN-TRN-04: pasos', () => {
    it('peso en múltiplos de 0.25', () => {
      expectOk({ weightKg: 62.25 }, prensa);
      expectOk({ weightKg: 62.75 }, prensa);
      expectProblem({ weightKg: 60.1 }, prensa, 'weightKg', 'step');
      expectProblem({ weightKg: 0.3 }, prensa, 'weightKg', 'step');
    });

    it('reps y RIR enteros', () => {
      expectProblem({ reps: 8.5 }, prensa, 'reps', 'step');
      expectProblem({ reps: 40.5 }, plancha, 'reps', 'step');
      expectProblem({ rir: 1.5 }, prensa, 'rir', 'step');
    });
  });

  describe('RN-TRN-04: no números', () => {
    it('NaN o infinito → not-a-number en su campo', () => {
      expectProblem({ weightKg: Number.NaN }, prensa, 'weightKg', 'not-a-number');
      expectProblem({ reps: Number.POSITIVE_INFINITY }, prensa, 'reps', 'not-a-number');
      expectProblem({ rir: Number.NaN }, prensa, 'rir', 'not-a-number');
      expectProblem({ weightKg: Number.NEGATIVE_INFINITY }, dominadas, 'weightKg', 'not-a-number');
    });
  });

  describe('RN-TRN-04: peso permitido según métrica y equipo', () => {
    it('peso no nulo en reps o time → not-allowed, también 0', () => {
      expectProblem({ weightKg: 0 }, deadBug, 'weightKg', 'not-allowed');
      expectProblem({ weightKg: 5 }, plancha, 'weightKg', 'not-allowed');
    });

    it('asistencia en bodyweight + weight: de −100 a 0', () => {
      expectOk({ weightKg: -20, reps: 8 }, dominadas, true);
      expectOk({ weightKg: -100 }, dominadas);
      expectOk({ weightKg: -17.5 }, dominadas);
      expectProblem({ weightKg: -100.25 }, dominadas, 'weightKg', 'out-of-range');
      expectProblem({ weightKg: -20.1 }, dominadas, 'weightKg', 'step');
      expectOk({ weightKg: 500 }, dominadas);
    });

    it('negativo sin asistencia → not-allowed', () => {
      expectProblem({ weightKg: -5 }, prensa, 'weightKg', 'not-allowed');
      expectProblem({ weightKg: -0.25 }, exercise('weight', 'cable'), 'weightKg', 'not-allowed');
    });
  });

  it('RN-TRN-04: varios errores → el primero en el orden kg, reps, RIR', () => {
    expectProblem({ weightKg: 600, reps: 200, rir: 20 }, prensa, 'weightKg', 'out-of-range');
    expectProblem({ reps: 200, rir: 20 }, prensa, 'reps', 'out-of-range');
    expectProblem({ rir: 20 }, prensa, 'weightKg', 'missing', true);
    expectProblem({ weightKg: 60, rir: 20 }, prensa, 'reps', 'missing', true);
  });

  it('RN-TRN-04: un valor inválido gana a uno que falta en un campo posterior', () => {
    expectProblem({ weightKg: 60.1 }, prensa, 'weightKg', 'step', true);
  });

  it('RN-TRN-04: devuelve los valores normalizados (-0 → 0)', () => {
    const result = checkSetValues(values({ weightKg: -0, reps: 0, rir: -0 }), prensa, {
      forDone: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.is(result.value.weightKg, 0)).toBe(true);
    expect(Object.is(result.value.rir, 0)).toBe(true);
  });
});
