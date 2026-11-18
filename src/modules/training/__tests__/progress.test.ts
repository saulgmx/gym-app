import { describe, expect, it } from 'vitest';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { progressOf } from '../domain/progress';
import type { SetLog, Workout, WorkoutItem, WorkoutState } from '../domain/types';

// Progress of a workout in progress (RN-TRN-20 and 21; spec 003 AC-16, AC-20 to AC-23). The
// domain gets the seconds per set as a function, so these tests use fake values instead of the
// seed's: every exercise has its own, so a swapped lookup changes the result.

const id = (s: string) => s as ID;
const CHANGE = 90;

const SECONDS: Record<string, number> = {
  a: 100,
  b: 200,
  c: 300,
  d: 110,
  e: 120,
  f: 130,
  g: 140,
};
const setSeconds = (exerciseId: ID) => {
  const seconds = SECONDS[exerciseId];
  if (seconds === undefined) throw new Error(`unexpected exercise ${exerciseId}`);
  return seconds;
};

// 'x' = done, '.' = not done, in setNumber order; a trailing '+' marks the extra sets that follow.
// 'xx.' → two planned sets done and one not; 'xx+x' → two planned done, one extra done.
type Pattern = string;

const workoutItem = (exerciseId: string, order: number, plannedSets: number): WorkoutItem => ({
  exerciseId: id(exerciseId),
  options: [id(exerciseId)],
  order,
  plannedSets,
  maxSets: plannedSets + 2,
  repRange: [8, 12],
  targetRir: [3, 4],
});

function setsOf(exerciseId: string, pattern: Pattern): SetLog[] {
  const [planned = '', extra = ''] = pattern.split('+');
  const make = (marks: string, offset: number, isExtra: boolean) =>
    marks.split('').map((mark, i): SetLog => ({
      id: id(`${exerciseId}-${String(offset + i + 1)}`),
      workoutId: id('w'),
      exerciseId: id(exerciseId),
      setNumber: offset + i + 1,
      weightKg: null,
      reps: null,
      rir: null,
      done: mark === 'x',
      isExtra,
    }));
  return [...make(planned, 0, false), ...make(extra, planned.length, true)];
}

/** One entry per exercise, in route order: [exercise id, pattern]. */
function stateOf(entries: [string, Pattern][]): WorkoutState {
  const workout: Workout = {
    id: id('w'),
    templateId: id('t'),
    name: 'Full body A',
    programWeek: 1,
    date: '2026-11-16' as LocalDate,
    plannedFor: '2026-11-16' as LocalDate,
    startedAt: '2026-11-16T18:00:00-06:00' as Instant,
    status: 'in_progress',
    items: entries.map(([exerciseId, pattern], i) =>
      workoutItem(exerciseId, i + 1, pattern.split('+')[0]?.length ?? 0),
    ),
  };
  return { workout, sets: entries.flatMap(([exerciseId, pattern]) => setsOf(exerciseId, pattern)) };
}

const progress = (entries: [string, Pattern][], change = CHANGE) =>
  progressOf(stateOf(entries), setSeconds, change);

describe('progressOf: ejercicios hechos (RN-TRN-21)', () => {
  it('RN-TRN-21: un ejercicio está hecho si todas sus series están hechas', () => {
    const p = progress([
      ['a', 'xx'],
      ['b', 'x.'],
      ['c', '..'],
    ]);
    expect(p.items).toEqual(['done', 'current', 'pending']);
    expect(p.itemsDone).toBe(1);
    expect(p.itemCount).toBe(3);
  });

  it('RN-TRN-21: una serie extra sin hacer deja el ejercicio pendiente (AC-22)', () => {
    const p = progress([
      ['a', 'xx+.'],
      ['b', '..'],
    ]);
    expect(p.items).toEqual(['current', 'pending']);
    expect(p.itemsDone).toBe(0);
    expect(p.current).toEqual({ itemIndex: 1, exerciseId: 'a', setNumber: 3 });
  });

  it('RN-TRN-21: una serie extra hecha no impide que el ejercicio esté hecho', () => {
    const p = progress([
      ['a', 'xx+x'],
      ['b', '..'],
    ]);
    expect(p.items).toEqual(['done', 'current']);
    expect(p.itemsDone).toBe(1);
  });

  it('RN-TRN-21: un ejercicio sin ninguna serie no cuenta como hecho ni como actual', () => {
    const p = progress([
      ['a', 'xx'],
      ['b', ''],
      ['c', 'x.'],
    ]);
    expect(p.items).toEqual(['done', 'pending', 'current']);
    expect(p.itemsDone).toBe(1);
    expect(p.current?.itemIndex).toBe(3);
  });
});

describe('progressOf: ejercicio y serie actuales (RN-TRN-21, spec 002 AC-4)', () => {
  it('RN-TRN-21: el actual es el primero con una serie sin hacer, con su índice desde 1', () => {
    const p = progress([
      ['a', 'xx'],
      ['b', 'x.'],
      ['c', '..'],
    ]);
    expect(p.current).toEqual({ itemIndex: 2, exerciseId: 'b', setNumber: 2 });
  });

  it('RN-TRN-21: la serie actual es la de menor setNumber sin hacer, aunque haya hechas después', () => {
    const p = progress([['a', '.x.']]);
    expect(p.current).toEqual({ itemIndex: 1, exerciseId: 'a', setNumber: 1 });
  });

  it('RN-TRN-21: no depende del orden en que vienen las series', () => {
    const state = stateOf([['a', 'x..']]);
    const reversed = { ...state, sets: [...state.sets].reverse() };
    expect(progressOf(reversed, setSeconds, CHANGE).current?.setNumber).toBe(2);
  });

  it('RN-TRN-21: un ejercicio posterior ya hecho sigue como hecho, y el actual es el primero pendiente', () => {
    const p = progress([
      ['a', 'x.'],
      ['b', 'xx'],
      ['c', '..'],
    ]);
    expect(p.items).toEqual(['current', 'done', 'pending']);
    expect(p.current?.itemIndex).toBe(1);
    expect(p.itemsDone).toBe(1);
  });

  it('AC-20: con todo hecho no hay ejercicio actual', () => {
    const p = progress([
      ['a', 'xx'],
      ['b', 'xx+x'],
    ]);
    expect(p.current).toBeNull();
    expect(p.items).toEqual(['done', 'done']);
    expect(p.itemsDone).toBe(2);
  });

  it('AC-21: recién iniciada, el primer ejercicio es el actual en su serie 1', () => {
    const p = progress([
      ['a', '..'],
      ['b', '..'],
    ]);
    expect(p.items).toEqual(['current', 'pending']);
    expect(p.itemsDone).toBe(0);
    expect(p.current).toEqual({ itemIndex: 1, exerciseId: 'a', setNumber: 1 });
  });

  it('AC-16: el ejemplo de la spec, 1 hecho, 1 actual y 5 pendientes', () => {
    // Prensa (2 series) hecha y la 1.ª de Press de banca hecha.
    const p = progress([
      ['a', 'xx'],
      ['b', 'x.'],
      ['c', '..'],
      ['d', '..'],
      ['e', '..'],
      ['f', '..'],
      ['g', '..'],
    ]);
    expect(p.itemCount).toBe(7);
    expect(p.itemsDone).toBe(1);
    expect(p.items).toEqual([
      'done',
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
    expect(p.current).toEqual({ itemIndex: 2, exerciseId: 'b', setNumber: 2 });
  });
});

describe('progressOf: series y ejercicios con series hechas (AC-23)', () => {
  it('AC-23: cuenta las series hechas y los ejercicios que tienen alguna', () => {
    // 2 de Prensa y 1 de Press de banca: 3 series en 2 ejercicios.
    const p = progress([
      ['a', 'xx'],
      ['b', 'x.'],
      ['c', '..'],
    ]);
    expect(p.setsDone).toBe(3);
    expect(p.itemsWithDoneSets).toBe(2);
  });

  it('AC-23: las series extra hechas cuentan; las pendientes no', () => {
    const p = progress([
      ['a', '..+x'],
      ['b', '..+.'],
    ]);
    expect(p.setsDone).toBe(1);
    expect(p.itemsWithDoneSets).toBe(1);
  });

  it('AC-23: sin series hechas ambos son 0', () => {
    const p = progress([['a', '..']]);
    expect(p.setsDone).toBe(0);
    expect(p.itemsWithDoneSets).toBe(0);
  });
});

describe('progressOf: tiempo restante (RN-TRN-20)', () => {
  it('RN-TRN-20: sin series hechas suma cada serie y un cambio por ejercicio, sin calentamiento', () => {
    const p = progress([
      ['a', '..'],
      ['b', '..'],
      ['c', '..'],
    ]);
    // 2 × 100 + 2 × 200 + 2 × 300 + 3 × 90
    expect(p.remainingSeconds).toBe(1470);
  });

  it('RN-TRN-20: un ejercicio hecho no suma sus series ni su cambio', () => {
    const p = progress([
      ['a', 'xx'],
      ['b', '..'],
      ['c', '..'],
    ]);
    expect(p.remainingSeconds).toBe(1470 - 200 - CHANGE);
  });

  it('RN-TRN-20: un ejercicio a medias suma solo las series pendientes y conserva su cambio', () => {
    const p = progress([
      ['a', 'xx'],
      ['b', 'x.'],
      ['c', '..'],
    ]);
    // b: 1 × 200 + 90; c: 2 × 300 + 90
    expect(p.remainingSeconds).toBe(200 + CHANGE + 600 + CHANGE);
  });

  it('RN-TRN-20: una serie extra pendiente suma y devuelve el cambio de un ejercicio hecho', () => {
    const p = progress([
      ['a', 'xx+.'],
      ['b', 'xx'],
    ]);
    // solo la extra de a: 100 + 90
    expect(p.remainingSeconds).toBe(100 + CHANGE);
  });

  it('RN-TRN-20: una serie extra hecha no suma', () => {
    const p = progress([
      ['a', 'xx+x'],
      ['b', 'x.'],
    ]);
    expect(p.remainingSeconds).toBe(200 + CHANGE);
  });

  it('RN-TRN-20: usa el tiempo por serie de cada ejercicio, no el del primero', () => {
    const p = progress([
      ['g', '.'],
      ['f', '.'],
    ]);
    expect(p.remainingSeconds).toBe(140 + 130 + 2 * CHANGE);
  });

  it('RN-TRN-20: el cambio de ejercicio sale del parámetro', () => {
    const p = progress(
      [
        ['a', '.'],
        ['b', '.'],
      ],
      10,
    );
    expect(p.remainingSeconds).toBe(100 + 200 + 2 * 10);
  });

  it('RN-TRN-20 / AC-20: sin series pendientes no hay estimación', () => {
    const p = progress([
      ['a', 'xx'],
      ['b', 'xx+x'],
    ]);
    expect(p.remainingSeconds).toBeNull();
  });
});
