import { describe, expect, it } from 'vitest';
import { sequentialIds, type ID, type Instant, type LocalDate } from '@/shared/kernel';
import {
  addExtraSet,
  chooseExercise,
  discardWorkout,
  logSetValues,
  removeSet,
  toggleSetDone,
} from '../domain/workout';
import type {
  ExerciseFacts,
  SetLog,
  TrainingErrorCode,
  Workout,
  WorkoutState,
  WorkoutStatus,
} from '../domain/types';

// Changes to a workout in progress (RN-TRN-04, 05, 07, 10, 11, 13, 15; contract v1.6, decision 8).

const id = (s: string) => s as ID;
const startedAt = '2026-11-21T09:30:00-06:00' as Instant;
const now = '2026-11-21T09:41:00-06:00' as Instant;

const exercises: ExerciseFacts[] = [
  { id: id('prensa'), metric: 'weight', equipment: 'machine' },
  { id: id('dominadas'), metric: 'weight', equipment: 'bodyweight' },
  { id: id('jalon'), metric: 'weight', equipment: 'cable' },
  { id: id('dead-bug'), metric: 'reps', equipment: 'bodyweight' },
];

const item = (exerciseId: string, options: string[], order: number, sets: [number, number]) => ({
  exerciseId: id(exerciseId),
  options: options.map(id),
  order,
  plannedSets: sets[0],
  maxSets: sets[1],
  repRange: [8, 12] as [number, number],
  targetRir: [3, 4] as [number, number],
});

const set = (key: string, exerciseId: string, setNumber: number, v: Partial<SetLog> = {}) =>
  ({
    id: id(key),
    workoutId: id('w'),
    exerciseId: id(exerciseId),
    setNumber,
    weightKg: null,
    reps: null,
    rir: null,
    done: false,
    isExtra: false,
    ...v,
  }) satisfies SetLog;

function state(status: WorkoutStatus = 'in_progress', sets?: SetLog[]): WorkoutState {
  const workout: Workout = {
    id: id('w'),
    templateId: id('tpl-a'),
    programWeek: 1,
    date: '2026-11-21' as LocalDate,
    plannedFor: '2026-11-21' as LocalDate,
    startedAt,
    status,
    items: [
      item('prensa', ['prensa'], 1, [2, 3]),
      item('dominadas', ['dominadas', 'jalon'], 2, [2, 3]),
      item('dead-bug', ['dead-bug'], 3, [1, 2]),
    ],
  };
  return {
    workout,
    sets: sets ?? [
      set('p1', 'prensa', 1),
      set('p2', 'prensa', 2),
      set('d1', 'dominadas', 1),
      set('d2', 'dominadas', 2),
      set('b1', 'dead-bug', 1),
    ],
  };
}

const done = (v: Partial<SetLog> = {}): Partial<SetLog> => ({
  weightKg: 60,
  reps: 10,
  done: true,
  completedAt: startedAt,
  ...v,
});

function expectCode(result: { ok: boolean; error?: { code: string } }, code: TrainingErrorCode) {
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe(code);
}

function changesOf<T>(result: { ok: true; value: T } | { ok: false }) {
  if (!result.ok) throw new Error('Expected ok');
  return result.value;
}

describe('RN-TRN-07: un workout cerrado no cambia', () => {
  for (const status of ['completed', 'discarded'] as const) {
    it(`${status} → training/workout-closed en todas las operaciones, antes que otro error`, () => {
      const s = state(status);
      expectCode(logSetValues(s, id('p1'), { reps: 10 }, exercises), 'training/workout-closed');
      expectCode(logSetValues(s, id('no-existe'), {}, exercises), 'training/workout-closed');
      expectCode(toggleSetDone(s, id('p1'), exercises, now), 'training/workout-closed');
      expectCode(addExtraSet(s, id('prensa'), sequentialIds()), 'training/workout-closed');
      expectCode(removeSet(s, id('p2')), 'training/workout-closed');
      expectCode(
        chooseExercise(s, id('dominadas'), id('jalon'), exercises, null),
        'training/workout-closed',
      );
      expectCode(discardWorkout(s), 'training/workout-closed');
    });
  }
});

describe('logSetValues', () => {
  it('RN-TRN-03: guarda solo la serie cambiada; un campo omitido no cambia', () => {
    const s = state('in_progress', [set('p1', 'prensa', 1, { reps: 9, rir: 2 })]);

    const { changes, value } = changesOf(logSetValues(s, id('p1'), { weightKg: 60 }, exercises));

    expect(value).toEqual(set('p1', 'prensa', 1, { weightKg: 60, reps: 9, rir: 2 }));
    expect(changes).toEqual({ put: [value], remove: [] });
  });

  it('RN-TRN-04: null borra el campo', () => {
    const s = state('in_progress', [set('p1', 'prensa', 1, { weightKg: 60, rir: 2 })]);
    const { value } = changesOf(logSetValues(s, id('p1'), { rir: null }, exercises));
    expect(value.rir).toBeNull();
    expect(value.weightKg).toBe(60);
  });

  it('RN-TRN-04: un valor inválido → invalid-set-values y nada cambia', () => {
    expectCode(
      logSetValues(state(), id('p1'), { weightKg: 60.1 }, exercises),
      'training/invalid-set-values',
    );
  });

  it('RN-TRN-04: valida con el ejercicio de la serie (asistencia solo en Dominadas)', () => {
    expect(logSetValues(state(), id('d1'), { weightKg: -20 }, exercises).ok).toBe(true);
    expectCode(
      logSetValues(state(), id('p1'), { weightKg: -20 }, exercises),
      'training/invalid-set-values',
    );
  });

  it('RN-TRN-04: una serie hecha sigue válida; borrar sus reps → missing', () => {
    const s = state('in_progress', [set('p1', 'prensa', 1, done())]);
    const result = logSetValues(s, id('p1'), { reps: null }, exercises);
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'training/invalid-set-values', details: { field: 'reps', reason: 'missing' } },
    });
  });

  it('RN-TRN-07: en curso, una serie hecha se edita y sigue hecha (AC-20)', () => {
    const s = state('in_progress', [set('p1', 'prensa', 1, done())]);
    const { value } = changesOf(logSetValues(s, id('p1'), { reps: 12 }, exercises));
    expect(value).toEqual(set('p1', 'prensa', 1, done({ reps: 12 })));
  });

  it('una serie inexistente → training/set-not-found', () => {
    expectCode(logSetValues(state(), id('no-existe'), {}, exercises), 'training/set-not-found');
  });
});

describe('toggleSetDone', () => {
  const withValues = (sets: SetLog[]) => state('in_progress', sets);

  it('RN-TRN-05: marcar fija done y completedAt = now', () => {
    const s = withValues([set('p1', 'prensa', 1, { weightKg: 60, reps: 10 })]);
    const { changes, value } = changesOf(toggleSetDone(s, id('p1'), exercises, now));
    expect(value).toEqual(
      set('p1', 'prensa', 1, { weightKg: 60, reps: 10, done: true, completedAt: now }),
    );
    expect(changes).toEqual({ put: [value], remove: [] });
  });

  it('RN-TRN-05: desmarcar quita completedAt y conserva los valores', () => {
    const s = withValues([set('p1', 'prensa', 1, done({ rir: 2 }))]);
    const { value } = changesOf(toggleSetDone(s, id('p1'), exercises, now));
    expect(value).toEqual(set('p1', 'prensa', 1, { weightKg: 60, reps: 10, rir: 2 }));
    expect(value).not.toHaveProperty('completedAt');
  });

  it('RN-TRN-04: sin lo obligatorio no se marca (missing del primer campo)', () => {
    const result = toggleSetDone(withValues([set('p1', 'prensa', 1)]), id('p1'), exercises, now);
    expect(result).toMatchObject({
      ok: false,
      error: { details: { field: 'weightKg', reason: 'missing' } },
    });
  });

  describe('RN-TRN-11: la serie siguiente hereda el peso', () => {
    it('la siguiente vacía recibe el peso, en los mismos cambios', () => {
      const s = withValues([
        set('p1', 'prensa', 1, { weightKg: 60, reps: 10 }),
        set('p2', 'prensa', 2),
      ]);
      const { changes } = changesOf(toggleSetDone(s, id('p1'), exercises, now));
      expect(changes.put).toEqual([
        set('p1', 'prensa', 1, { weightKg: 60, reps: 10, done: true, completedAt: now }),
        set('p2', 'prensa', 2, { weightKg: 60 }),
      ]);
    });

    it('la asistencia (peso negativo) también se hereda', () => {
      const s = withValues([
        set('d1', 'dominadas', 1, { weightKg: -20, reps: 8 }),
        set('d2', 'dominadas', 2),
      ]);
      const { changes } = changesOf(toggleSetDone(s, id('d1'), exercises, now));
      expect(changes.put[1]).toEqual(set('d2', 'dominadas', 2, { weightKg: -20 }));
    });

    it('si la siguiente ya tiene peso o está hecha, no cambia', () => {
      const withWeight = withValues([
        set('p1', 'prensa', 1, { weightKg: 60, reps: 10 }),
        set('p2', 'prensa', 2, { weightKg: 65 }),
      ]);
      expect(
        changesOf(toggleSetDone(withWeight, id('p1'), exercises, now)).changes.put,
      ).toHaveLength(1);
      // A done set always has its weight; null here isolates the "not done" half of the rule.
      const nextDone = withValues([
        set('p1', 'prensa', 1, { weightKg: 60, reps: 10 }),
        set('p2', 'prensa', 2, done({ weightKg: null })),
      ]);
      expect(changesOf(toggleSetDone(nextDone, id('p1'), exercises, now)).changes.put).toHaveLength(
        1,
      );
    });

    it('solo la serie setNumber + 1 del mismo ejercicio', () => {
      const s = withValues([
        set('p1', 'prensa', 1),
        set('p2', 'prensa', 2, { weightKg: 60, reps: 10 }),
        set('p3', 'prensa', 3),
        set('d1', 'dominadas', 1),
      ]);
      const { changes } = changesOf(toggleSetDone(s, id('p2'), exercises, now));
      expect(changes.put.map((x) => x.id)).toEqual(['p2', 'p3']);
    });

    it('la última serie no afecta a ninguna otra', () => {
      const s = withValues([
        set('p1', 'prensa', 1),
        set('p2', 'prensa', 2, { weightKg: 60, reps: 10 }),
        set('d1', 'dominadas', 1),
      ]);
      expect(changesOf(toggleSetDone(s, id('p2'), exercises, now)).changes.put).toHaveLength(1);
    });

    it('al desmarcar no toca la siguiente', () => {
      const s = withValues([set('p1', 'prensa', 1, done()), set('p2', 'prensa', 2)]);
      expect(changesOf(toggleSetDone(s, id('p1'), exercises, now)).changes.put).toHaveLength(1);
    });

    it('sin peso (reps o time) no hay nada que heredar', () => {
      const s = withValues([set('b1', 'dead-bug', 1, { reps: 10 }), set('b2', 'dead-bug', 2)]);
      expect(changesOf(toggleSetDone(s, id('b1'), exercises, now)).changes.put).toHaveLength(1);
    });
  });

  it('una serie inexistente → training/set-not-found', () => {
    expectCode(toggleSetDone(state(), id('no-existe'), exercises, now), 'training/set-not-found');
  });
});

describe('addExtraSet', () => {
  it('RN-TRN-10: añade la serie n + 1 extra con el peso de la última', () => {
    const s = state('in_progress', [
      set('p1', 'prensa', 1, done()),
      set('p2', 'prensa', 2, { weightKg: 62.5, reps: 8, rir: 1 }),
    ]);
    const { changes, value } = changesOf(addExtraSet(s, id('prensa'), sequentialIds('new')));
    expect(value).toEqual({
      ...set('new-0001', 'prensa', 3, { weightKg: 62.5 }),
      isExtra: true,
    });
    expect(changes).toEqual({ put: [value], remove: [] });
  });

  it('RN-TRN-10: la última sin peso → la extra sin peso', () => {
    const { value } = changesOf(addExtraSet(state(), id('prensa'), sequentialIds('new')));
    expect(value.weightKg).toBeNull();
    expect(value.setNumber).toBe(3);
  });

  it('RN-TRN-10: con maxSets series (todas cuentan) → training/max-sets-reached', () => {
    const s = state('in_progress', [
      set('p1', 'prensa', 1),
      set('p2', 'prensa', 2),
      set('p3', 'prensa', 3, { isExtra: true }),
    ]);
    expectCode(addExtraSet(s, id('prensa'), sequentialIds()), 'training/max-sets-reached');
  });

  it('un ejercicio que no es de ningún ítem → lanza', () => {
    expect(() => addExtraSet(state(), id('jalon'), sequentialIds())).toThrow(/jalon/);
  });
});

describe('removeSet', () => {
  const three = () =>
    state('in_progress', [
      set('p1', 'prensa', 1, done()),
      set('p2', 'prensa', 2),
      set('p3', 'prensa', 3, { isExtra: true, weightKg: 60 }),
      set('d1', 'dominadas', 1),
    ]);

  it('RN-TRN-10: quita una serie no hecha y renumera las siguientes, conservando isExtra', () => {
    const { changes } = changesOf(removeSet(three(), id('p2')));
    expect(changes).toEqual({
      remove: ['p2'],
      put: [set('p3', 'prensa', 2, { isExtra: true, weightKg: 60 })],
    });
  });

  it('RN-TRN-10: quitar la última no renumera nada', () => {
    expect(changesOf(removeSet(three(), id('p3'))).changes).toEqual({ remove: ['p3'], put: [] });
  });

  it('RN-TRN-10: una serie hecha → training/set-not-removable', () => {
    expectCode(removeSet(three(), id('p1')), 'training/set-not-removable');
  });

  it('RN-TRN-10: la única serie del ejercicio → training/set-not-removable', () => {
    expectCode(removeSet(three(), id('d1')), 'training/set-not-removable');
  });

  it('una serie inexistente → training/set-not-found', () => {
    expectCode(removeSet(three(), id('no-existe')), 'training/set-not-found');
  });
});

describe('chooseExercise', () => {
  it('RN-TRN-13: cambia el ítem y sus series; reinicia todos los valores', () => {
    const s = state('in_progress', [
      set('d1', 'dominadas', 1, { weightKg: -20, reps: 7, rir: 2 }),
      set('d2', 'dominadas', 2, { weightKg: -20 }),
      set('p1', 'prensa', 1, done()),
    ]);

    const { changes, value } = changesOf(
      chooseExercise(s, id('dominadas'), id('jalon'), exercises, 45),
    );

    expect(value.items[1]).toMatchObject({ exerciseId: 'jalon', options: ['dominadas', 'jalon'] });
    expect(value.items[0]).toEqual(s.workout.items[0]);
    expect(changes.workout).toBe(value);
    expect(changes.remove).toEqual([]);
    expect(changes.put).toEqual([
      set('d1', 'jalon', 1, { weightKg: 45 }),
      set('d2', 'jalon', 2, { weightKg: 45 }),
    ]);
  });

  it('RN-TRN-13: el prellenado es defensivo (null o inválido → sin peso)', () => {
    for (const prefill of [null, 45.1, -20]) {
      const { changes } = changesOf(
        chooseExercise(state(), id('dominadas'), id('jalon'), exercises, prefill),
      );
      expect(
        changes.put.every((x) => x.weightKg === null),
        String(prefill),
      ).toBe(true);
    }
  });

  it('RN-TRN-13: se puede volver al principal', () => {
    const s = state();
    s.workout.items[1] = { ...item('jalon', ['dominadas', 'jalon'], 2, [2, 3]) };
    s.sets = [set('d1', 'jalon', 1)];
    const { value } = changesOf(chooseExercise(s, id('jalon'), id('dominadas'), exercises, -20));
    expect(value.items[1]?.exerciseId).toBe('dominadas');
  });

  it('RN-TRN-13: from == to → ok sin cambios', () => {
    const s = state();
    const { changes, value } = changesOf(
      chooseExercise(s, id('dominadas'), id('dominadas'), exercises, 10),
    );
    expect(changes).toEqual({ put: [], remove: [] });
    expect(value).toBe(s.workout);
  });

  it('RN-TRN-13: fuera de options → training/invalid-exercise-choice', () => {
    expectCode(
      chooseExercise(state(), id('dominadas'), id('prensa'), exercises, null),
      'training/invalid-exercise-choice',
    );
  });

  it('RN-TRN-13: con una serie hecha → training/item-has-done-sets', () => {
    const s = state('in_progress', [set('d1', 'dominadas', 1, done()), set('d2', 'dominadas', 2)]);
    expectCode(
      chooseExercise(s, id('dominadas'), id('jalon'), exercises, null),
      'training/item-has-done-sets',
    );
  });

  it('un from que no es de ningún ítem → lanza', () => {
    expect(() => chooseExercise(state(), id('jalon'), id('dominadas'), exercises, null)).toThrow(
      /jalon/,
    );
  });
});

describe('discardWorkout', () => {
  it('RN-TRN-15: pasa a discarded, sin finishedAt, y conserva las series', () => {
    const s = state();
    const { changes, value } = changesOf(discardWorkout(s));
    expect(value).toEqual({ ...s.workout, status: 'discarded' });
    expect(value).not.toHaveProperty('finishedAt');
    expect(changes).toEqual({ workout: value, put: [], remove: [] });
  });
});
