import { describe, expect, it } from 'vitest';
import type { ID, Instant, LocalDate, SeriesRow } from '@/shared/kernel';
import { seriesRows } from '../domain/series';
import type {
  SeriesExercise,
  SetLog,
  WorkoutItem,
  WorkoutState,
  WorkoutStatus,
} from '../domain/types';

// RN-TRN-31 (spec 008): the rows of the series CSV. Example data of spec 008 §4, trimmed, with the
// real names, `order` and `metric` of the seed (Full body A: Prensa 1, Dominadas 3, Dead bug 7;
// Full body B: Hack squat 1, Fondos 6). States, items and sets are stored out of order on purpose,
// so the tests see the sort and not the input position.

const id = (s: string) => s as ID;

const exercise = (key: string, name: string, metric: SeriesExercise['metric']): SeriesExercise => ({
  id: id(key),
  name,
  metric,
});

const exercises: SeriesExercise[] = [
  exercise('prensa', 'Prensa de piernas', 'weight'),
  exercise('dominadas', 'Dominadas', 'weight'),
  exercise('jalon', 'Jalón al pecho', 'weight'),
  exercise('deadbug', 'Dead bug', 'reps'),
  exercise('hack', 'Hack squat', 'weight'),
  exercise('fondos', 'Fondos en paralelas', 'weight'),
  exercise('plancha', 'Plancha', 'time'),
];

const item = (exerciseId: string, order: number, options = [exerciseId]): WorkoutItem => ({
  exerciseId: id(exerciseId),
  options: options.map(id),
  order,
  plannedSets: 2,
  maxSets: 3,
  repRange: [8, 12],
  targetRir: [1, 2],
});

interface SetSpec {
  ex: string;
  n: number;
  kg?: number | null;
  reps?: number | null;
  rir?: number | null;
  done?: boolean;
  extra?: boolean;
  completedAt?: string | null; // null = missing (tolerated broken data); default for done sets
}

interface WorkoutSpec {
  id: string;
  name?: string;
  status?: WorkoutStatus;
  date: string;
  plannedFor?: string;
  week?: number | null;
  startedAt?: string;
  items: WorkoutItem[];
  sets: SetSpec[];
}

const setLog = (w: WorkoutSpec, s: SetSpec): SetLog => {
  const done = s.done ?? true;
  const completedAt =
    s.completedAt === undefined
      ? done
        ? `${w.date}T18:0${String(s.n)}:00-06:00`
        : null
      : s.completedAt;
  return {
    id: id(`${w.id}-${s.ex}-${String(s.n)}`),
    workoutId: id(w.id),
    exerciseId: id(s.ex),
    setNumber: s.n,
    weightKg: s.kg === undefined ? 60 : s.kg,
    reps: s.reps === undefined ? 10 : s.reps,
    rir: s.rir === undefined ? 2 : s.rir,
    done,
    isExtra: s.extra ?? false,
    ...(completedAt === null ? {} : { completedAt: completedAt as Instant }),
  };
};

const state = (w: WorkoutSpec): WorkoutState => {
  const status = w.status ?? 'completed';
  const week = w.week === undefined ? 1 : w.week;
  return {
    workout: {
      id: id(w.id),
      templateId: week === null ? null : id('tpl'),
      name: w.name ?? 'Full body A',
      programWeek: week,
      date: w.date as LocalDate,
      plannedFor: (w.plannedFor ?? w.date) as LocalDate,
      startedAt: (w.startedAt ?? `${w.date}T17:30:00-06:00`) as Instant,
      ...(status === 'completed' ? { finishedAt: `${w.date}T19:00:00-06:00` as Instant } : {}),
      status,
      items: w.items,
    },
    sets: w.sets.map((s) => setLog(w, s)),
  };
};

const notDone = { done: false, kg: null, reps: null, rir: null } as const;

// L16: Full body A, completed, Dominadas swapped for Jalón al pecho (RN-PLN-11, RN-TRN-13).
const l16 = state({
  id: 'w-l16',
  date: '2026-11-16',
  items: [item('deadbug', 7), item('jalon', 3, ['dominadas', 'jalon']), item('prensa', 1)],
  sets: [
    { ex: 'deadbug', n: 2, kg: null, reps: 12, rir: 1 },
    { ex: 'deadbug', n: 1, kg: null, reps: 12, rir: 1 },
    { ex: 'prensa', n: 3, kg: 100, reps: 8 },
    { ex: 'jalon', n: 2, kg: 55 },
    { ex: 'prensa', n: 2, kg: 100, reps: 9, rir: 2, completedAt: '2026-11-16T18:06:00-06:00' },
    { ex: 'jalon', n: 1, kg: 55 },
    { ex: 'prensa', n: 1, kg: 100 },
  ],
});

// M17: Full body B, discarded with 2 done sets.
const m17 = state({
  id: 'w-m17',
  name: 'Full body B',
  status: 'discarded',
  date: '2026-11-17',
  items: [item('hack', 1)],
  sets: [
    { ex: 'hack', n: 1 },
    { ex: 'hack', n: 2 },
  ],
});

// M18: Friday's Full body A done on Wednesday (RN-TRN-14), 2 of 4 sets done; assisted Dominadas.
const m18 = state({
  id: 'w-m18',
  date: '2026-11-18',
  plannedFor: '2026-11-20',
  startedAt: '2026-11-18T19:00:00-06:00',
  items: [item('prensa', 1), item('dominadas', 3, ['dominadas', 'jalon']), item('deadbug', 7)],
  sets: [
    { ex: 'deadbug', n: 1, ...notDone },
    { ex: 'dominadas', n: 1, kg: -20, reps: 8, rir: 2 },
    { ex: 'prensa', n: 2, ...notDone },
    { ex: 'prensa', n: 1, kg: 90 },
  ],
});

// L23: Full body B, week 2, Fondos with an extra 3rd set (RN-TRN-10).
const l23 = state({
  id: 'w-l23',
  name: 'Full body B',
  date: '2026-11-23',
  week: 2,
  items: [item('fondos', 6), item('hack', 1)],
  sets: [
    { ex: 'fondos', n: 3, kg: 0, reps: 8, rir: 1, extra: true },
    { ex: 'hack', n: 1, kg: 80 },
    { ex: 'fondos', n: 1, kg: 0 },
    { ex: 'fondos', n: 2, kg: 0 },
  ],
});

const example = [l23, m17, l16, m18];

const brief = (rows: SeriesRow[]) =>
  rows.map((r) => `${r.date} ${r.session} ${r.exercise} ${String(r.setNumber)}`);

const find = (rows: SeriesRow[], date: string, exerciseName: string, setNumber: number) => {
  const row = rows.find(
    (r) => r.date === date && r.exercise === exerciseName && r.setNumber === setNumber,
  );
  if (!row) throw new Error(`no row ${date} ${exerciseName} ${String(setNumber)}`);
  return row;
};

const thrown = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  throw new Error('it did not throw');
};

describe('seriesRows', () => {
  it('RN-TRN-31 (a), AC-10, AC-11: solo series hechas de workouts completed, por date, order del ítem y setNumber', () => {
    expect(brief(seriesRows(example, exercises))).toEqual([
      '2026-11-16 Full body A Prensa de piernas 1',
      '2026-11-16 Full body A Prensa de piernas 2',
      '2026-11-16 Full body A Prensa de piernas 3',
      '2026-11-16 Full body A Jalón al pecho 1',
      '2026-11-16 Full body A Jalón al pecho 2',
      '2026-11-16 Full body A Dead bug 1',
      '2026-11-16 Full body A Dead bug 2',
      '2026-11-18 Full body A Prensa de piernas 1',
      '2026-11-18 Full body A Dominadas 1',
      '2026-11-23 Full body B Hack squat 1',
      '2026-11-23 Full body B Fondos en paralelas 1',
      '2026-11-23 Full body B Fondos en paralelas 2',
      '2026-11-23 Full body B Fondos en paralelas 3',
    ]);
  });

  it('RN-TRN-31, AC-12: la 2.ª de Prensa de piernas de L16 sale con todos sus campos', () => {
    expect(find(seriesRows(example, exercises), '2026-11-16', 'Prensa de piernas', 2)).toEqual({
      date: '2026-11-16',
      week: 1,
      session: 'Full body A',
      exercise: 'Prensa de piernas',
      metric: 'weight',
      setNumber: 2,
      weightKg: 100,
      reps: 9,
      rir: 2,
      isExtra: false,
      completedAt: '2026-11-16T18:06:00-06:00',
    });
  });

  it('RN-TRN-31, AC-13: el nombre es el del ejercicio usado (Jalón al pecho), no el principal', () => {
    const l16Names = seriesRows([l16], exercises).map((r) => r.exercise);
    expect(l16Names).toContain('Jalón al pecho');
    expect(l16Names).not.toContain('Dominadas');
  });

  it('RN-TRN-31 (e), AC-14: asistencia -20, session sin "del viernes" y date (no plannedFor)', () => {
    expect(find(seriesRows(example, exercises), '2026-11-18', 'Dominadas', 1)).toEqual({
      date: '2026-11-18',
      week: 1,
      session: 'Full body A',
      exercise: 'Dominadas',
      metric: 'weight',
      setNumber: 1,
      weightKg: -20,
      reps: 8,
      rir: 2,
      isExtra: false,
      completedAt: '2026-11-18T18:01:00-06:00',
    });
  });

  it('RN-TRN-31 (b), AC-15: la 3.ª extra de Fondos lleva peso 0, isExtra y la semana 2', () => {
    expect(find(seriesRows(example, exercises), '2026-11-23', 'Fondos en paralelas', 3)).toEqual({
      date: '2026-11-23',
      week: 2,
      session: 'Full body B',
      exercise: 'Fondos en paralelas',
      metric: 'weight',
      setNumber: 3,
      weightKg: 0,
      reps: 8,
      rir: 1,
      isExtra: true,
      completedAt: '2026-11-23T18:03:00-06:00',
    });
  });

  it('RN-TRN-31, AC-16: Dead bug lleva metric reps y weightKg null', () => {
    const row = find(seriesRows(example, exercises), '2026-11-16', 'Dead bug', 1);
    expect(row).toMatchObject({ metric: 'reps', weightKg: null, reps: 12, rir: 1 });
  });

  it('RN-TRN-31 (e), AC-17, AC-19, AC-20: fuera del programa, Plancha en segundos, sin RIR y sin completedAt', () => {
    const free = state({
      id: 'w-free',
      name: 'Sesión libre',
      date: '2026-11-25',
      week: null,
      items: [item('plancha', 1)],
      sets: [
        { ex: 'plancha', n: 2, kg: null, reps: 45, rir: null, completedAt: null },
        { ex: 'plancha', n: 1, kg: null, reps: 40, rir: 2 },
      ],
    });
    expect(seriesRows([free], exercises)).toEqual([
      {
        date: '2026-11-25',
        week: null,
        session: 'Sesión libre',
        exercise: 'Plancha',
        metric: 'time',
        setNumber: 1,
        weightKg: null,
        reps: 40,
        rir: 2,
        isExtra: false,
        completedAt: '2026-11-25T18:01:00-06:00',
      },
      {
        date: '2026-11-25',
        week: null,
        session: 'Sesión libre',
        exercise: 'Plancha',
        metric: 'time',
        setNumber: 2,
        weightKg: null,
        reps: 45,
        rir: null,
        isExtra: false,
        completedAt: null,
      },
    ]);
  });

  it('RN-TRN-31: ordena por date, no por plannedFor', () => {
    // Wednesday's session is Friday's (RN-TRN-14); Thursday's is its own day.
    const wed = state({
      id: 'w-wed',
      date: '2026-11-18',
      plannedFor: '2026-11-20',
      items: [item('prensa', 1)],
      sets: [{ ex: 'prensa', n: 1 }],
    });
    const thu = state({
      id: 'w-thu',
      date: '2026-11-19',
      items: [item('hack', 1)],
      sets: [{ ex: 'hack', n: 1 }],
    });
    expect(seriesRows([thu, wed], exercises).map((r) => r.date)).toEqual([
      '2026-11-18',
      '2026-11-19',
    ]);
  });

  it('RN-TRN-31, AC-25: mismo date, primero el startedAt menor como instante (ADR-0009), no como texto', () => {
    // 10:00−06:00 is 16:00Z and 09:00−08:00 is 17:00Z: as strings the second one would go first.
    const first = state({
      id: 'w-b',
      date: '2026-11-20',
      startedAt: '2026-11-20T10:00:00-06:00',
      items: [item('prensa', 1)],
      sets: [{ ex: 'prensa', n: 1 }],
    });
    const second = state({
      id: 'w-a',
      date: '2026-11-20',
      startedAt: '2026-11-20T09:00:00-08:00',
      items: [item('hack', 1)],
      sets: [{ ex: 'hack', n: 1 }],
    });
    expect(seriesRows([second, first], exercises).map((r) => r.exercise)).toEqual([
      'Prensa de piernas',
      'Hack squat',
    ]);
  });

  it('RN-TRN-31 (d): mismo date y mismo startedAt (con otro offset), por id', () => {
    // The same instant written two ways; as strings w-b would go first, by id w-a does.
    const b = state({
      id: 'w-b',
      date: '2026-11-20',
      startedAt: '2026-11-20T10:00:00-06:00',
      items: [item('prensa', 1)],
      sets: [{ ex: 'prensa', n: 1 }],
    });
    const a = state({
      id: 'w-a',
      date: '2026-11-20',
      startedAt: '2026-11-20T16:00:00Z',
      items: [item('hack', 1)],
      sets: [{ ex: 'hack', n: 1 }],
    });
    expect(seriesRows([b, a], exercises).map((r) => r.exercise)).toEqual([
      'Hack squat',
      'Prensa de piernas',
    ]);
    expect(seriesRows([a, b], exercises).map((r) => r.exercise)).toEqual([
      'Hack squat',
      'Prensa de piernas',
    ]);
  });

  it('RN-TRN-31 (c), AC-23: sin workouts completed el resultado es []', () => {
    expect(seriesRows([], [])).toEqual([]);
    expect(seriesRows([m17], exercises)).toEqual([]);
    expect(
      seriesRows([{ ...l16, workout: { ...l16.workout, status: 'in_progress' } }], exercises),
    ).toEqual([]);
  });

  it('RN-TRN-31 (b), (g): una serie hecha sin ítem lanza citando la regla y los IDs', () => {
    const broken = state({
      id: 'w-broken',
      date: '2026-11-20',
      items: [item('prensa', 1)],
      sets: [
        { ex: 'prensa', n: 1 },
        { ex: 'hack', n: 1 },
      ],
    });
    const message = thrown(() => seriesRows([broken], exercises));
    expect(message).toMatch(/RN-TRN-31/);
    expect(message).toContain('w-broken-hack-1');
    expect(message).toContain('hack');
  });

  it('RN-TRN-31 (b), (g): una serie hecha cuyo ejercicio no llegó de plan lanza citando la regla y los IDs', () => {
    const message = thrown(() =>
      seriesRows(
        [l23],
        exercises.filter((e) => e.id !== id('fondos')),
      ),
    );
    expect(message).toMatch(/RN-TRN-31/);
    expect(message).toContain('w-l23-fondos-');
    expect(message).toContain('fondos');
  });

  it('RN-TRN-31 (g): las series que no salen no se comprueban', () => {
    // A not-done set without an item, in a completed workout.
    const undone = state({
      id: 'w-undone',
      date: '2026-11-20',
      items: [item('prensa', 1)],
      sets: [
        { ex: 'prensa', n: 1 },
        { ex: 'hack', n: 1, ...notDone },
      ],
    });
    // Done sets without item or exercise, in workouts that are not completed.
    const discarded = state({
      id: 'w-discarded',
      status: 'discarded',
      date: '2026-11-21',
      items: [item('hack', 1)],
      sets: [{ ex: 'ghost', n: 1 }],
    });
    const active = state({
      id: 'w-active',
      status: 'in_progress',
      date: '2026-11-22',
      items: [item('ghost', 1)],
      sets: [{ ex: 'ghost', n: 1 }],
    });
    // Only Prensa comes out, so plan only returns Prensa (RN-TRN-31 (c)).
    const onlyPrensa = exercises.filter((e) => e.id === id('prensa'));
    expect(brief(seriesRows([undone, discarded, active], onlyPrensa))).toEqual([
      '2026-11-20 Full body A Prensa de piernas 1',
    ]);
  });

  it('RN-TRN-31 (h): no modifica states ni exercises', () => {
    const states = [l23, m17, l16, m18];
    const before = structuredClone(states);
    const exercisesBefore = structuredClone(exercises);
    seriesRows(states, exercises);
    expect(states).toEqual(before);
    expect(exercises).toEqual(exercisesBefore);
  });
});
