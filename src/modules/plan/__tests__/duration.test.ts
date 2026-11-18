import { describe, expect, it } from 'vitest';
import type { ID } from '@/shared/kernel';
import {
  EXERCISE_CHANGE_SECONDS,
  SET_WORK_SECONDS,
  WARMUP_SECONDS,
  displayMinutes,
  plannedSessionSeconds,
  setSeconds,
} from '../domain/duration';
import type { Exercise, PlannedItem } from '../domain/types';

// RN-PLN-27 (spec 003, AC-1, AC-5, AC-6). Pure functions; expected values worked out by hand
// from the formula: warm-up 600 + Σ (plannedSets × (work + average rest) + 90 per exercise).
// Real-seed cases (50, 55 and 75 min, deload) live in app/seed/__tests__/duration.test.ts.

const exercise = (
  metric: Exercise['metric'],
  restSeconds: [number, number] = [60, 90],
): Exercise => ({
  id: `${metric}-${String(restSeconds[0])}` as ID,
  name: metric,
  muscleGroup: 'quads',
  equipment: 'machine',
  metric,
  lumbarRisk: 'low',
  isPrimary: false,
  restSeconds,
});

const item = (ex: Exercise, plannedSets: number, repRange: [number, number]): PlannedItem => ({
  exercise: ex,
  alternatives: [],
  order: 1,
  plannedSets,
  repRange,
  targetRir: [3, 4],
});

describe('constants (RN-PLN-27)', () => {
  it('RN-PLN-27: 600 s de calentamiento, 45 s de trabajo y 90 s de cambio de ejercicio', () => {
    expect(WARMUP_SECONDS).toBe(600);
    expect(SET_WORK_SECONDS).toBe(45);
    expect(EXERCISE_CHANGE_SECONDS).toBe(90);
  });
});

describe('setSeconds', () => {
  it('RN-PLN-27: con metric weight, 45 s de trabajo más el descanso medio', () => {
    expect(setSeconds(exercise('weight', [60, 90]), [8, 12])).toBe(120); // 45 + 75
  });

  it('RN-PLN-27: con metric reps, 45 s de trabajo más el descanso medio', () => {
    expect(setSeconds(exercise('reps', [30, 60]), [10, 15])).toBe(90); // 45 + 45
  });

  it('RN-PLN-27: con metric time, el trabajo es la media de repRange', () => {
    expect(setSeconds(exercise('time', [60, 90]), [30, 45])).toBe(112.5); // 37.5 + 75
    expect(setSeconds(exercise('time', [30, 60]), [20, 40])).toBe(75); // 30 + 45
  });

  it('RN-PLN-27: sin redondear antes de displayMinutes', () => {
    expect(setSeconds(exercise('time', [60, 90]), [31, 44])).toBe(112.5);
    expect(setSeconds(exercise('time', [61, 90]), [30, 45])).toBe(113);
  });
});

describe('plannedSessionSeconds', () => {
  it('RN-PLN-27: sin ejercicios solo cuenta el calentamiento', () => {
    expect(plannedSessionSeconds([])).toBe(600);
  });

  it('RN-PLN-27: suma series × (trabajo + descanso) y un cambio por ejercicio', () => {
    const items = [item(exercise('weight'), 3, [8, 12])];
    expect(plannedSessionSeconds(items)).toBe(1050); // 600 + 3 × 120 + 90
  });

  it('RN-PLN-27: varios ejercicios, uno de ellos de tiempo', () => {
    const items = [item(exercise('weight'), 3, [8, 12]), item(exercise('time'), 2, [30, 45])];
    expect(plannedSessionSeconds(items)).toBe(1365); // 1050 + 2 × 112.5 + 90
  });

  it('AC-5: el deload usa las series ya reducidas al 50% (plannedSets)', () => {
    const full = [item(exercise('weight'), 4, [8, 12]), item(exercise('weight'), 2, [8, 12])];
    const deload = [item(exercise('weight'), 2, [8, 12]), item(exercise('weight'), 1, [8, 12])];
    expect(plannedSessionSeconds(full)).toBe(1500); // 600 + 6 × 120 + 180
    expect(plannedSessionSeconds(deload)).toBe(1140); // 600 + 3 × 120 + 180
  });
});

describe('displayMinutes', () => {
  it('RN-PLN-27: redondea al múltiplo de 5 más cercano', () => {
    expect(displayMinutes(3000)).toBe(50);
    expect(displayMinutes(1050)).toBe(20); // 17.5 min
    expect(displayMinutes(1365)).toBe(25); // 22.75 min
    expect(displayMinutes(3390)).toBe(55); // 56.5 min
  });

  it('RN-PLN-27: el punto medio sube (Math.round) y justo debajo baja', () => {
    expect(displayMinutes(750)).toBe(15); // 12.5 min
    expect(displayMinutes(749)).toBe(10);
  });

  it('RN-PLN-27: el mínimo es 5', () => {
    expect(displayMinutes(0)).toBe(5);
    expect(displayMinutes(60)).toBe(5);
    expect(displayMinutes(149)).toBe(5);
    expect(displayMinutes(300)).toBe(5);
  });
});
