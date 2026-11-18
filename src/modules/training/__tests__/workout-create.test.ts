import { describe, expect, it } from 'vitest';
import { sequentialIds, type ID, type Instant, type LocalDate } from '@/shared/kernel';
import { checkPlannedFor, createWorkout } from '../domain/workout';
import type { ExerciseFacts, PlannedSession } from '../domain/types';

// Creating a workout (RN-TRN-02, 12, 14; contract v1.5, decision 7). Dates checked with Node:
// 2026-11-16 Monday, 21 Saturday, 22 Sunday, 23 Monday; 2026-12-28 Monday, 2027-01-03 Sunday.

const date = (s: string) => s as LocalDate;
const id = (s: string) => s as ID;
const now = '2026-11-21T09:30:00-06:00' as Instant;

const facts = (key: string, metric: ExerciseFacts['metric'] = 'weight', equipment = 'machine') => ({
  id: id(key),
  metric,
  equipment,
});
const exercises: ExerciseFacts[] = [
  facts('prensa'),
  facts('dominadas', 'weight', 'bodyweight'),
  facts('dead-bug', 'reps', 'bodyweight'),
];

const session = (): PlannedSession => ({
  templateId: id('tpl-a'),
  name: 'Full body A',
  programWeek: 1,
  items: [
    {
      exerciseId: id('prensa'),
      alternativeIds: [],
      order: 1,
      plannedSets: 2,
      maxSets: 3,
      repRange: [8, 12],
      targetRir: [3, 4],
      note: 'Pelvis pegada al respaldo',
    },
    {
      exerciseId: id('dominadas'),
      alternativeIds: [id('jalon')],
      order: 2,
      plannedSets: 2,
      maxSets: 3,
      repRange: [6, 10],
      targetRir: [3, 4],
    },
    {
      exerciseId: id('dead-bug'),
      alternativeIds: [],
      order: 3,
      plannedSets: 1,
      maxSets: 2,
      repRange: [8, 10],
      targetRir: [3, 4],
    },
  ],
});

const create = (
  overrides: { session?: PlannedSession; prefill?: ReadonlyMap<ID, number | null> } = {},
) =>
  createWorkout({
    session: overrides.session ?? session(),
    date: date('2026-11-21'),
    plannedFor: date('2026-11-20'),
    now,
    ids: sequentialIds('id'),
    exercises,
    prefill: overrides.prefill ?? new Map(),
  });

describe('checkPlannedFor', () => {
  it('RN-TRN-14: el mismo día o cualquier día de la misma semana ISO → ok', () => {
    for (const d of ['2026-11-16', '2026-11-21', '2026-11-22']) {
      expect(checkPlannedFor(date('2026-11-21'), date(d)), d).toEqual({
        ok: true,
        value: undefined,
      });
    }
  });

  it('RN-TRN-14: otra semana → training/planned-date-out-of-week', () => {
    for (const d of ['2026-11-15', '2026-11-23']) {
      const result = checkPlannedFor(date('2026-11-21'), date(d));
      expect(result.ok, d).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('training/planned-date-out-of-week');
        expect(result.error.message).toMatch(/RN-TRN-14/);
      }
    }
  });

  it('RN-TRN-14: la semana ISO cruza el año (lunes 28-dic a domingo 3-ene)', () => {
    expect(checkPlannedFor(date('2027-01-03'), date('2026-12-28')).ok).toBe(true);
    expect(checkPlannedFor(date('2027-01-04'), date('2027-01-03')).ok).toBe(false);
  });
});

describe('createWorkout', () => {
  it('RN-TRN-02: workout in_progress con la fecha real, el día del plan y la instantánea', () => {
    const { workout } = create();

    expect(workout).toEqual({
      id: 'id-0001',
      templateId: 'tpl-a',
      name: 'Full body A',
      programWeek: 1,
      date: '2026-11-21',
      plannedFor: '2026-11-20',
      startedAt: now,
      status: 'in_progress',
      items: [
        {
          exerciseId: 'prensa',
          options: ['prensa'],
          order: 1,
          plannedSets: 2,
          maxSets: 3,
          repRange: [8, 12],
          targetRir: [3, 4],
          note: 'Pelvis pegada al respaldo',
        },
        {
          exerciseId: 'dominadas',
          options: ['dominadas', 'jalon'],
          order: 2,
          plannedSets: 2,
          maxSets: 3,
          repRange: [6, 10],
          targetRir: [3, 4],
        },
        {
          exerciseId: 'dead-bug',
          options: ['dead-bug'],
          order: 3,
          plannedSets: 1,
          maxSets: 2,
          repRange: [8, 10],
          targetRir: [3, 4],
        },
      ],
    });
    expect(workout.items[1]).not.toHaveProperty('note');
  });

  it('RN-TRN-02: plannedSets series vacías por ejercicio, numeradas desde 1', () => {
    const { sets } = create();

    expect(sets.map((s) => [s.exerciseId, s.setNumber])).toEqual([
      ['prensa', 1],
      ['prensa', 2],
      ['dominadas', 1],
      ['dominadas', 2],
      ['dead-bug', 1],
    ]);
    for (const set of sets) {
      expect(set).toEqual({
        id: set.id,
        workoutId: 'id-0001',
        exerciseId: set.exerciseId,
        setNumber: set.setNumber,
        weightKg: null,
        reps: null,
        rir: null,
        done: false,
        isExtra: false,
      });
    }
  });

  it('RN-TRN-02: IDs del workout primero y luego de las series, en orden', () => {
    const { workout, sets } = create();
    expect(workout.id).toBe('id-0001');
    expect(sets.map((s) => s.id)).toEqual(['id-0002', 'id-0003', 'id-0004', 'id-0005', 'id-0006']);
  });

  it('RN-TRN-02: los ítems salen por order aunque lleguen desordenados', () => {
    const shuffled = session();
    shuffled.items.reverse();
    expect(create({ session: shuffled }).workout.items.map((i) => i.order)).toEqual([1, 2, 3]);
  });

  describe('RN-TRN-02: prellenado defensivo', () => {
    it('el peso sugerido llena todas las series del ejercicio', () => {
      const { sets } = create({
        prefill: new Map([
          [id('prensa'), 60],
          [id('dominadas'), -20],
        ]),
      });
      expect(sets.map((s) => s.weightKg)).toEqual([60, 60, -20, -20, null]);
    });

    it('sin sugerencia, o con null → peso vacío', () => {
      const { sets } = create({ prefill: new Map([[id('prensa'), null]]) });
      expect(sets.every((s) => s.weightKg === null)).toBe(true);
    });

    it('en reps o time el peso empieza en null aunque haya sugerencia', () => {
      const { sets } = create({ prefill: new Map([[id('dead-bug'), 10]]) });
      expect(sets.find((s) => s.exerciseId === 'dead-bug')?.weightKg).toBeNull();
    });

    it('una sugerencia que no cumple RN-TRN-04 se ignora, sin error', () => {
      const { sets } = create({
        prefill: new Map([
          [id('prensa'), 61.3],
          [id('dominadas'), Number.NaN],
        ]),
      });
      expect(sets.every((s) => s.weightKg === null)).toBe(true);
    });
  });

  describe('RN-TRN-12: un ejercicio por workout', () => {
    it('el mismo principal en dos ítems → lanza', () => {
      const duplicated = session();
      const second = duplicated.items[1];
      if (second) second.exerciseId = id('prensa');
      expect(() => create({ session: duplicated })).toThrow(/RN-TRN-12/);
    });

    it('la alternativa de un ítem es el principal de otro → lanza', () => {
      const duplicated = session();
      const second = duplicated.items[1];
      if (second) second.alternativeIds = [id('prensa')];
      expect(() => create({ session: duplicated })).toThrow(/RN-TRN-12/);
    });
  });

  it('un ejercicio principal sin sus datos en exercises → lanza', () => {
    expect(() =>
      createWorkout({
        session: session(),
        date: date('2026-11-21'),
        plannedFor: date('2026-11-21'),
        now,
        ids: sequentialIds('id'),
        exercises: exercises.filter((e) => e.id !== 'dead-bug'),
        prefill: new Map(),
      }),
    ).toThrow(/dead-bug/);
  });
});
