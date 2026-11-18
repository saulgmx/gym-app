import { describe, expect, it } from 'vitest';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { workoutProgress, type SetLog, type WorkoutItem, type WorkoutView } from '..';
import type { Exercise } from '../application/ports';

// workoutProgress(view): the application builds the seconds per set with plan's setSeconds
// (RN-TRN-20, spec 003 plan §3). Hand-built views; the real seed (40 and 25 min) is checked in
// app/__tests__/workout-progress.test.ts. Expected seconds: work 45 s (or the mean of repRange
// when metric = 'time') + mean rest, and 90 s per item with a set left.

const id = (s: string) => s as ID;

const exercise = (key: string, overrides: Partial<Exercise> = {}): Exercise => ({
  id: id(key),
  name: key,
  muscleGroup: 'back',
  equipment: 'machine',
  metric: 'weight',
  lumbarRisk: 'low',
  isPrimary: false,
  restSeconds: [60, 90],
  ...overrides,
});

const dominadas = exercise('dominadas', { equipment: 'bodyweight', restSeconds: [120, 180] });
const jalon = exercise('jalon', { equipment: 'cable', restSeconds: [60, 90] });
const plancha = exercise('plancha', { muscleGroup: 'core', metric: 'time' });

const item = (
  exerciseId: string,
  options: string[],
  order: number,
  plannedSets: number,
  repRange: [number, number],
): WorkoutItem => ({
  exerciseId: id(exerciseId),
  options: options.map(id),
  order,
  plannedSets,
  maxSets: plannedSets + 1,
  repRange,
  targetRir: [3, 4],
});

const set = (exerciseId: string, setNumber: number, done = false): SetLog => ({
  id: id(`${exerciseId}-${String(setNumber)}`),
  workoutId: id('w'),
  exerciseId: id(exerciseId),
  setNumber,
  weightKg: null,
  reps: null,
  rir: null,
  done,
  isExtra: false,
});

function viewOf(items: WorkoutItem[], sets: SetLog[], exercises: Exercise[]): WorkoutView {
  return {
    workout: {
      id: id('w'),
      templateId: id('tpl-a'),
      name: 'Full body A',
      programWeek: 1,
      date: '2026-11-16' as LocalDate,
      plannedFor: '2026-11-16' as LocalDate,
      startedAt: '2026-11-16T18:00:00-06:00' as Instant,
      status: 'in_progress',
      items,
    },
    sets,
    exercises: Object.fromEntries(exercises.map((e) => [e.id, e])),
  };
}

describe('workoutProgress (RN-TRN-20, RN-TRN-21)', () => {
  it('RN-TRN-20: usa el descanso del ejercicio elegido del ítem, no el de la opción principal (RN-TRN-13)', () => {
    // The item switched from Dominadas to Jalón: 45 + 75 + 90, not 45 + 150 + 90.
    const view = viewOf(
      [item('jalon', ['dominadas', 'jalon'], 1, 1, [6, 10])],
      [set('jalon', 1)],
      [dominadas, jalon],
    );
    expect(workoutProgress(view).remainingSeconds).toBe(210);
  });

  it('RN-TRN-20: con metric time el trabajo es la media del repRange del ítem', () => {
    // 2 × (37.5 + 75) + 90
    const view = viewOf(
      [item('plancha', ['plancha'], 1, 2, [30, 45])],
      [set('plancha', 1), set('plancha', 2)],
      [plancha],
    );
    expect(workoutProgress(view).remainingSeconds).toBe(315);
  });

  it('RN-TRN-20: suma un cambio de ejercicio de 90 s por ítem con series pendientes', () => {
    // dominadas: 1 × (45 + 150) + 90; plancha: 1 × (37.5 + 75) + 90
    const view = viewOf(
      [
        item('dominadas', ['dominadas', 'jalon'], 1, 2, [6, 10]),
        item('plancha', ['plancha'], 2, 1, [30, 45]),
      ],
      [set('dominadas', 1, true), set('dominadas', 2), set('plancha', 1)],
      [dominadas, jalon, plancha],
    );
    expect(workoutProgress(view).remainingSeconds).toBe(285 + 202.5);
  });

  it('RN-TRN-21: devuelve el avance del dominio (actual, estados y series hechas)', () => {
    const view = viewOf(
      [
        item('dominadas', ['dominadas', 'jalon'], 1, 2, [6, 10]),
        item('plancha', ['plancha'], 2, 1, [30, 45]),
      ],
      [set('dominadas', 1, true), set('dominadas', 2, true), set('plancha', 1)],
      [dominadas, jalon, plancha],
    );
    expect(workoutProgress(view)).toEqual({
      itemsDone: 1,
      itemCount: 2,
      items: ['done', 'current'],
      current: { itemIndex: 2, exerciseId: 'plancha', setNumber: 1 },
      remainingSeconds: 112.5 + 90,
      setsDone: 2,
      itemsWithDoneSets: 1,
    });
  });

  it('RN-TRN-20: sin series pendientes no hay estimación', () => {
    const view = viewOf(
      [item('jalon', ['dominadas', 'jalon'], 1, 1, [6, 10])],
      [set('jalon', 1, true)],
      [dominadas, jalon],
    );
    expect(workoutProgress(view).remainingSeconds).toBeNull();
  });

  it('RN-TRN-17: si a la vista le falta el ejercicio de un ítem con series pendientes → lanza', () => {
    const view = viewOf(
      [item('plancha', ['plancha'], 1, 1, [30, 45])],
      [set('plancha', 1)],
      [dominadas],
    );
    expect(() => workoutProgress(view)).toThrow(/plancha/);
  });
});
