import { describe, expect, it } from 'vitest';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { exerciseHistory, historyDetail } from '../domain/history';
import type { SetLog, WorkoutItem, WorkoutState, WorkoutStatus } from '../domain/types';

// RN-TRN-08 holds on its own, even if a repository returns more than completed workouts.

const id = (s: string) => s as ID;

const state = (key: string, status: WorkoutStatus): WorkoutState => ({
  workout: {
    id: id(key),
    templateId: id('tpl'),
    name: 'Full body A',
    programWeek: 1,
    date: '2026-11-09' as LocalDate,
    plannedFor: '2026-11-09' as LocalDate,
    startedAt: '2026-11-09T09:00:00-06:00' as Instant,
    status,
    items: [
      {
        exerciseId: id('prensa'),
        options: [id('prensa')],
        order: 1,
        plannedSets: 1,
        maxSets: 1,
        repRange: [8, 12],
        targetRir: [3, 4],
      },
    ],
  },
  sets: [
    {
      id: id(`${key}-1`),
      workoutId: id(key),
      exerciseId: id('prensa'),
      setNumber: 1,
      weightKg: 60,
      reps: 10,
      rir: 2,
      done: true,
      isExtra: false,
    },
  ],
});

describe('exerciseHistory', () => {
  it('RN-TRN-08: ignora workouts in_progress y discarded aunque tengan series hechas', () => {
    const states = [state('a', 'in_progress'), state('b', 'discarded'), state('c', 'completed')];
    expect(exerciseHistory(states, id('prensa')).map((s) => s.workoutId)).toEqual(['c']);
  });
});

describe('historyDetail', () => {
  const item = (exerciseId: string, order: number, options = [exerciseId]): WorkoutItem => ({
    exerciseId: id(exerciseId),
    options: options.map(id),
    order,
    plannedSets: 2,
    maxSets: 3,
    repRange: [8, 12],
    targetRir: [2, 3],
  });

  const set = (exerciseId: string, setNumber: number, done: boolean, isExtra = false): SetLog => ({
    id: id(`${exerciseId}-${String(setNumber)}`),
    workoutId: id('w'),
    exerciseId: id(exerciseId),
    setNumber,
    weightKg: 60,
    reps: 10,
    rir: 2,
    done,
    isExtra,
  });

  // Items stored out of order on purpose, so the test sees `order` and not the array position.
  // Dominadas was swapped for Jalón al pecho (RN-TRN-13). The done set of 'dominadas' cannot
  // happen through the API; it checks the chosen-exercise filter against inconsistent data.
  const view = (status: WorkoutStatus): WorkoutState => {
    const base = state('w', status);
    return {
      workout: {
        ...base.workout,
        items: [item('banca', 2), item('jalon', 3, ['dominadas', 'jalon']), item('prensa', 1)],
      },
      sets: [
        set('prensa', 2, true),
        set('jalon', 3, true, true),
        set('banca', 1, false),
        set('prensa', 3, false),
        set('dominadas', 1, true),
        set('jalon', 1, true),
        set('prensa', 1, true),
        set('banca', 2, false),
      ],
    };
  };

  const summary = (items: ReturnType<typeof historyDetail>) =>
    items?.map((i) => ({
      exerciseId: i.exerciseId,
      replaces: i.replaces,
      sets: i.sets.map((s) => s.id),
    }));

  it('RN-TRN-29: un elemento por ítem, por su order y no por la posición en el arreglo', () => {
    expect(historyDetail(view('completed'))?.map((i) => i.exerciseId)).toEqual([
      'prensa',
      'banca',
      'jalon',
    ]);
  });

  it('RN-TRN-29: solo las series hechas del ejercicio elegido, por setNumber, con las extra', () => {
    expect(summary(historyDetail(view('completed')))).toEqual([
      { exerciseId: 'prensa', replaces: null, sets: ['prensa-1', 'prensa-2'] },
      { exerciseId: 'banca', replaces: null, sets: [] },
      { exerciseId: 'jalon', replaces: 'dominadas', sets: ['jalon-1', 'jalon-3'] },
    ]);
  });

  it('RN-TRN-29: las series salen tal cual, con isExtra', () => {
    const jalon = historyDetail(view('completed'))?.[2];
    expect(jalon?.sets.map((s) => s.isExtra)).toEqual([false, true]);
    expect(jalon?.sets[0]).toEqual(set('jalon', 1, true));
  });

  it('RN-TRN-29: in_progress y discarded → null', () => {
    expect(historyDetail(view('in_progress'))).toBeNull();
    expect(historyDetail(view('discarded'))).toBeNull();
  });
});
