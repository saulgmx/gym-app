import { describe, expect, it } from 'vitest';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { workoutSummary } from '../domain/summary';
import type { SetLog, Workout, WorkoutItem, WorkoutState, WorkoutStatus } from '../domain/types';
import { checkFinishable, finishWorkout } from '../domain/workout';

// Closing a workout and its summary (RN-TRN-07, 22, 25; contract v1.21, decision 23; spec 005
// AC-7, AC-8, AC-18 to AC-20). The state is Full body A of week 1: 7 items and 10 planned sets.

const id = (s: string) => s as ID;
const at = (s: string) => s as Instant;
const startedAt = at('2026-11-16T18:00:00-06:00');
const now = at('2026-11-16T18:52:00-06:00');

const item = (exerciseId: string, order: number, plannedSets: number): WorkoutItem => ({
  exerciseId: id(exerciseId),
  options: [id(exerciseId)],
  order,
  plannedSets,
  maxSets: plannedSets + 1,
  repRange: [8, 12],
  targetRir: [2, 3],
});

const ITEMS: [string, number][] = [
  ['prensa', 2],
  ['press', 2],
  ['dominadas', 2],
  ['remo', 1],
  ['curl', 1],
  ['triceps', 1],
  ['plancha', 1],
];

const set = (exerciseId: string, setNumber: number, done: boolean, isExtra = false): SetLog => ({
  id: id(`${exerciseId}-${String(setNumber)}`),
  workoutId: id('w'),
  exerciseId: id(exerciseId),
  setNumber,
  weightKg: done ? 40 : null,
  reps: done ? 10 : null,
  rir: done ? 2 : null,
  done,
  isExtra,
  ...(done ? { completedAt: startedAt } : {}),
});

// Every planned set, done when `isDone(exerciseId, setNumber)` says so.
function state(
  isDone: (exerciseId: string, setNumber: number) => boolean,
  overrides: Partial<Workout> = {},
  extra: SetLog[] = [],
): WorkoutState {
  const workout: Workout = {
    id: id('w'),
    templateId: id('tpl-a'),
    name: 'Full body A',
    programWeek: 1,
    date: '2026-11-16' as LocalDate,
    plannedFor: '2026-11-16' as LocalDate,
    startedAt,
    status: 'in_progress',
    items: ITEMS.map(([exerciseId, sets], i) => item(exerciseId, i + 1, sets)),
    ...overrides,
  };
  const sets = ITEMS.flatMap(([exerciseId, n]) =>
    Array.from({ length: n }, (_, i) => set(exerciseId, i + 1, isDone(exerciseId, i + 1))),
  );
  return { workout, sets: [...sets, ...extra] };
}

const all = () => true;
const none = () => false;
// The partial example: both Prensa sets, the 1st Press de banca and both Dominadas (5 sets, 3 items).
const partial = (exerciseId: string, setNumber: number) =>
  exerciseId === 'prensa' ||
  exerciseId === 'dominadas' ||
  (exerciseId === 'press' && setNumber === 1);

const input = (v: { notes?: string; hasPain?: boolean; now?: Instant } = {}) => ({
  now,
  hasPain: true,
  ...v,
});

function expectError(result: ReturnType<typeof finishWorkout>, code: string, rule: RegExp) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
  expect(result.error.message).toMatch(rule);
}

function closedWorkout(result: ReturnType<typeof finishWorkout>) {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}`);
  return result.value;
}

describe('finishWorkout', () => {
  it('RN-TRN-22: pasa a completed con finishedAt = now; changes solo lleva el workout (AC-18)', () => {
    const before = state(all);

    const { changes, value } = closedWorkout(finishWorkout(before, input()));

    expect(value).toEqual({ ...before.workout, status: 'completed', finishedAt: now });
    expect(changes).toEqual({ workout: value, put: [], remove: [] });
  });

  it('RN-TRN-22: las series no hechas se conservan intactas (AC-20)', () => {
    const before = state(partial);

    const { changes } = closedWorkout(finishWorkout(before, input()));

    expect(changes.put).toEqual([]);
    expect(changes.remove).toEqual([]);
    expect(before.sets.filter((s) => !s.done)).toHaveLength(5);
  });

  it.each<WorkoutStatus>(['completed', 'discarded'])(
    'RN-TRN-07: un workout %s da workout-closed antes que todo (AC-31)',
    (status) => {
      expectError(
        finishWorkout(state(none, { status }), input({ hasPain: false, notes: 'x'.repeat(2001) })),
        'training/workout-closed',
        /RN-TRN-07/,
      );
    },
  );

  it('RN-TRN-22: sin series hechas da nothing-done antes que la falta de dolor', () => {
    expectError(
      finishWorkout(state(none), input({ hasPain: false })),
      'training/nothing-done',
      /RN-TRN-22/,
    );
  });

  it('RN-TRN-22: una sola serie extra hecha basta para cerrar', () => {
    const extra = set('prensa', 3, true, true);

    expect(finishWorkout(state(none, {}, [extra]), input()).ok).toBe(true);
  });

  it('RN-TRN-06: sin dolor da pain-required, antes que las notas largas', () => {
    expectError(
      finishWorkout(state(all), input({ hasPain: false, notes: 'x'.repeat(2001) })),
      'training/pain-required',
      /RN-TRN-06/,
    );
  });

  it('RN-TRN-22: las notas se guardan recortadas (AC-19)', () => {
    const { value } = closedWorkout(
      finishWorkout(state(all), input({ notes: '  Buena sesión\n' })),
    );

    expect(value.notes).toBe('Buena sesión');
  });

  it.each([undefined, '', '   ', '\n\t '])(
    'RN-TRN-22: con notas %j el workout no tiene la propiedad notes (AC-19)',
    (notes) => {
      const { value } = closedWorkout(
        finishWorkout(state(all), input(notes === undefined ? {} : { notes })),
      );

      expect(value).not.toHaveProperty('notes');
    },
  );

  it('RN-TRN-22: unas notas viejas del workout no sobreviven a unas notas vacías', () => {
    const { value } = closedWorkout(
      finishWorkout(state(all, { notes: 'vieja' }), input({ notes: ' ' })),
    );

    expect(value).not.toHaveProperty('notes');
  });

  it('RN-TRN-22: 2000 caracteres tras recortar se aceptan, aunque con espacios midan más', () => {
    const notes = `  ${'a'.repeat(2000)}  `;

    expect(closedWorkout(finishWorkout(state(all), input({ notes }))).value.notes).toHaveLength(
      2000,
    );
  });

  it('RN-TRN-22: 2001 caracteres tras recortar dan notes-too-long', () => {
    expectError(
      finishWorkout(state(all), input({ notes: 'a'.repeat(2001) })),
      'training/notes-too-long',
      /RN-TRN-22/,
    );
  });

  it('RN-TRN-22: las notas se miden en unidades UTF-16, como el maxlength del campo', () => {
    // '💪' is 2 UTF-16 code units: 1000 of them are 2000 units, 1001 are 2002.
    expect(finishWorkout(state(all), input({ notes: '💪'.repeat(1000) })).ok).toBe(true);
    expectError(
      finishWorkout(state(all), input({ notes: '💪'.repeat(1001) })),
      'training/notes-too-long',
      /RN-TRN-22/,
    );
  });

  it('RN-TRN-22: finishedAt es now aunque sea anterior a startedAt (reloj hacia atrás)', () => {
    const earlier = at('2026-11-16T17:00:00-06:00');

    expect(closedWorkout(finishWorkout(state(all), input({ now: earlier }))).value.finishedAt).toBe(
      earlier,
    );
  });

  it('RN-TRN-22: no modifica el estado de entrada', () => {
    const before = state(all);
    const snapshot = structuredClone(before);

    finishWorkout(before, input({ notes: 'ok' }));

    expect(before).toEqual(snapshot);
  });
});

describe('checkFinishable', () => {
  it('RN-TRN-22: ok en curso con una serie hecha', () => {
    expect(checkFinishable(state(partial))).toEqual({ ok: true, value: undefined });
  });

  it('RN-TRN-22: workout-closed y nothing-done, en ese orden', () => {
    const closedNone = checkFinishable(state(none, { status: 'completed' }));
    expect(closedNone.ok).toBe(false);
    if (!closedNone.ok) expect(closedNone.error.code).toBe('training/workout-closed');

    const openNone = checkFinishable(state(none));
    expect(openNone.ok).toBe(false);
    if (!openNone.ok) expect(openNone.error.code).toBe('training/nothing-done');
  });
});

describe('workoutSummary', () => {
  it('RN-TRN-25: el ejemplo completo da 52 min, 10 series y 7 de 7 ítems (AC-7)', () => {
    expect(workoutSummary(state(all), now)).toEqual({
      minutes: 52,
      setsDone: 10,
      itemsWithDoneSets: 7,
      itemCount: 7,
    });
  });

  it('RN-TRN-25: el ejemplo parcial a las 18:30 da 30 min, 5 series y 3 de 7 ítems (AC-8)', () => {
    expect(workoutSummary(state(partial), at('2026-11-16T18:30:00-06:00'))).toEqual({
      minutes: 30,
      setsDone: 5,
      itemsWithDoneSets: 3,
      itemCount: 7,
    });
  });

  it('RN-TRN-25: 52 min 59 s redondea hacia abajo a 52', () => {
    expect(workoutSummary(state(all), at('2026-11-16T18:52:59-06:00')).minutes).toBe(52);
  });

  it('RN-TRN-25: con el reloj hacia atrás los minutos son 0', () => {
    expect(workoutSummary(state(all), at('2026-11-16T17:59:00-06:00')).minutes).toBe(0);
  });

  it('RN-TRN-25: un workout cerrado usa su finishedAt, no el now que recibe', () => {
    const closed = state(all, { status: 'completed', finishedAt: at('2026-11-16T18:45:00-06:00') });

    expect(workoutSummary(closed, at('2026-11-18T10:00:00-06:00')).minutes).toBe(45);
  });

  it('RN-TRN-25: offsets distintos se restan como instantes (ADR-0009)', () => {
    // 18:00-06:00 is 00:00Z next day; 01:10+01:00 is the same 00:10Z.
    expect(workoutSummary(state(all), at('2026-11-17T01:10:00+01:00')).minutes).toBe(10);
  });

  it('RN-TRN-25: una serie extra hecha cuenta en setsDone', () => {
    const extra = set('prensa', 3, true, true);

    expect(workoutSummary(state(all, {}, [extra]), now).setsDone).toBe(11);
  });

  it('RN-TRN-25: sin series hechas, 0 series y 0 de 7 ítems', () => {
    expect(workoutSummary(state(none), now)).toMatchObject({
      setsDone: 0,
      itemsWithDoneSets: 0,
      itemCount: 7,
    });
  });

  it('RN-TRN-25: una serie hecha de otro ejercicio que el elegido no marca el ítem', () => {
    // Prensa's item now uses an alternative; a stray done set of Prensa does not count for it.
    const s = state(none);
    const items = s.workout.items.map((i) =>
      i.exerciseId === id('prensa')
        ? { ...i, exerciseId: id('hack'), options: [id('prensa'), id('hack')] }
        : i,
    );
    const stray = set('prensa', 1, true);

    const summary = workoutSummary({ workout: { ...s.workout, items }, sets: [stray] }, now);

    expect(summary.itemsWithDoneSets).toBe(0);
    expect(summary.setsDone).toBe(1);
    expect(summary.itemCount).toBe(7); // the items, not the exercises that have sets
  });
});
