import { describe, expect, it } from 'vitest';
import type { ID, LocalDate } from '@/shared/kernel';
import { getDayPlan, getPosition, getWeekPlan, type PlanSnapshot } from '../domain/schedule';
import type { Block, Exercise, ScheduleEntry, SessionTemplate, TodayPlan } from '../domain/types';

// Small 6-week program, starting Monday 2026-11-16 (dates checked with Node):
// block 1 = weeks 1-3 (A/B alternation), block 2 = weeks 4-5 (starts on an even program week),
// deload = week 6 (reuses a block 2 template, RN-PLN-12).

const date = (s: string) => s as LocalDate;
const id = (s: string) => s as ID;

const exercise = (key: string, overrides: Partial<Exercise> = {}): Exercise => ({
  id: id(key),
  name: key,
  muscleGroup: 'quads',
  equipment: 'machine',
  metric: 'weight',
  lumbarRisk: 'low',
  isPrimary: false,
  restSeconds: [60, 90],
  ...overrides,
});

const exercises: Exercise[] = [
  exercise('prensa', { name: 'Prensa de piernas', isPrimary: true }),
  exercise('curl-femoral', { name: 'Curl femoral', muscleGroup: 'hamstrings' }),
  exercise('plancha', { name: 'Plancha', muscleGroup: 'core', metric: 'time' }),
  exercise('banca', { name: 'Press de banca', muscleGroup: 'chest', isPrimary: true }),
  exercise('curl-sentado', { name: 'Curl femoral sentado', muscleGroup: 'hamstrings' }),
  exercise('curl-tumbado', { name: 'Curl femoral tumbado', muscleGroup: 'hamstrings' }),
];

const templates: SessionTemplate[] = [
  {
    id: id('tpl-a'),
    blockId: id('block-1'),
    name: 'Full body A',
    // Stored out of order on purpose (RN-PLN-17).
    items: [
      {
        exerciseId: id('curl-femoral'),
        // Not in catalog order, so the test sees the seed's order (RN-PLN-11).
        alternatives: [id('curl-tumbado'), id('curl-sentado')],
        order: 2,
        sets: [2, 3],
        reps: [10, 12],
      },
      {
        exerciseId: id('prensa'),
        order: 1,
        sets: [3, 3],
        reps: [8, 12],
        note: 'Pelvis pegada al respaldo',
      },
    ],
  },
  {
    id: id('tpl-b'),
    blockId: id('block-1'),
    name: 'Full body B',
    items: [{ exerciseId: id('plancha'), order: 1, sets: [3, 3], reps: [30, 45] }],
  },
  {
    id: id('tpl-c'),
    blockId: id('block-2'),
    name: 'Torso',
    items: [{ exerciseId: id('banca'), order: 1, sets: [3, 4], reps: [6, 10] }],
  },
];

// Weekday: 0 = Sunday, 1 = Monday … 6 = Saturday.
const workout = (
  weekday: ScheduleEntry['weekday'],
  templateId: string,
  weekParity?: 'odd' | 'even',
) =>
  weekParity
    ? ({ weekday, kind: 'workout', templateId: id(templateId), weekParity } as const)
    : ({ weekday, kind: 'workout', templateId: id(templateId) } as const);
const cardio = (weekday: ScheduleEntry['weekday'], note: string) =>
  ({ weekday, kind: 'cardio', note }) as const;
const rest = (weekday: ScheduleEntry['weekday']) => ({ weekday, kind: 'rest' }) as const;

const block1: Block = {
  id: id('block-1'),
  programId: id('program'),
  name: 'Bloque 1 · Full body',
  startWeek: 1,
  endWeek: 3,
  targetRir: [2, 3],
  weekRir: { 1: [3, 4] },
  weekFactors: { 1: 0.7 },
  isDeload: false,
  schedule: [
    workout(1, 'tpl-a', 'odd'),
    workout(1, 'tpl-b', 'even'),
    cardio(2, 'Cardio suave 30-40 min'),
    workout(3, 'tpl-b', 'odd'),
    workout(3, 'tpl-a', 'even'),
    rest(4),
    workout(5, 'tpl-a', 'odd'),
    workout(5, 'tpl-b', 'even'),
    cardio(6, 'Cardio moderado 20-30 min'),
    rest(0),
  ],
};

const block2: Block = {
  id: id('block-2'),
  programId: id('program'),
  name: 'Bloque 2 · Torso',
  startWeek: 4,
  endWeek: 5,
  targetRir: [1, 3],
  weekFactors: {},
  isDeload: false,
  schedule: [
    workout(1, 'tpl-c', 'odd'),
    workout(1, 'tpl-a', 'even'),
    rest(2),
    rest(3),
    rest(4),
    rest(5),
    rest(6),
    rest(0),
  ],
};

const deload: Block = {
  id: id('block-deload'),
  programId: id('program'),
  name: 'Descarga',
  startWeek: 6,
  endWeek: 6,
  targetRir: [4, 4],
  weekFactors: {},
  isDeload: true,
  schedule: [workout(1, 'tpl-c'), rest(2), rest(3), rest(4), rest(5), rest(6), rest(0)],
};

const snapshot: PlanSnapshot = {
  program: {
    id: id('program'),
    name: 'Programa de prueba',
    startDate: date('2026-11-16'),
    totalWeeks: 6,
    blockIds: [block1.id, block2.id, deload.id],
  },
  blocks: [block1, block2, deload],
  templates,
  exercises,
};

const templateName = (plan: TodayPlan) =>
  plan.kind === 'workout' ? plan.template.name : plan.kind;

const workoutPlan = (d: string) => {
  const plan = getDayPlan(snapshot, date(d));
  if (plan.kind !== 'workout') throw new Error(`Expected a workout on ${d}, got ${plan.kind}`);
  return plan;
};

describe('getPosition', () => {
  it('RN-PLN-01: antes del inicio → not_started, sin semana ni bloque, factor 1', () => {
    expect(getPosition(snapshot, date('2026-11-15'))).toEqual({
      status: 'not_started',
      startDate: '2026-11-16',
      totalWeeks: 6,
      week: null,
      block: null,
      isDeloadWeek: false,
      volumeFactor: 1,
    });
  });

  it('RN-PLN-01: el primer día es la semana 1 y el domingo sigue en la semana 1', () => {
    expect(getPosition(snapshot, date('2026-11-16'))).toMatchObject({ status: 'active', week: 1 });
    expect(getPosition(snapshot, date('2026-11-22'))).toMatchObject({ status: 'active', week: 1 });
    expect(getPosition(snapshot, date('2026-11-23'))).toMatchObject({ status: 'active', week: 2 });
  });

  it('RN-PLN-01: el último domingo es la última semana; el día siguiente → finished', () => {
    expect(getPosition(snapshot, date('2026-12-27'))).toMatchObject({ status: 'active', week: 6 });
    expect(getPosition(snapshot, date('2026-12-28'))).toEqual({
      status: 'finished',
      startDate: '2026-11-16',
      totalWeeks: 6,
      week: null,
      block: null,
      isDeloadWeek: false,
      volumeFactor: 1,
    });
  });

  it('RN-PLN-01: dentro del programa también lleva startDate y totalWeeks', () => {
    expect(getPosition(snapshot, date('2026-11-25'))).toMatchObject({
      status: 'active',
      startDate: '2026-11-16',
      totalWeeks: 6,
      week: 2,
    });
  });

  it('RN-PLN-02: una semana sin bloque es un bug → lanza', () => {
    const withGap: PlanSnapshot = { ...snapshot, blocks: [block1, deload] };
    expect(() => getPosition(withGap, date('2026-12-07'))).toThrow(); // week 4
  });

  it('RN-PLN-02: el bloque activo es el que contiene la semana', () => {
    expect(getPosition(snapshot, date('2026-11-30')).block?.id).toBe('block-1'); // week 3
    expect(getPosition(snapshot, date('2026-12-07')).block?.id).toBe('block-2'); // week 4
    expect(getPosition(snapshot, date('2026-12-21')).block?.id).toBe('block-deload'); // week 6
  });

  it('RN-PLN-04: factor de la semana, 1.0 por defecto y 0.5 en deload', () => {
    expect(getPosition(snapshot, date('2026-11-16'))).toMatchObject({
      volumeFactor: 0.7,
      isDeloadWeek: false,
    });
    expect(getPosition(snapshot, date('2026-11-23')).volumeFactor).toBe(1);
    expect(getPosition(snapshot, date('2026-12-21'))).toMatchObject({
      volumeFactor: 0.5,
      isDeloadWeek: true,
    });
  });
});

describe('getDayPlan', () => {
  it('RN-PLN-03: semana 1 (impar) → A el lunes, B el miércoles, A el viernes', () => {
    expect(templateName(getDayPlan(snapshot, date('2026-11-16')))).toBe('Full body A');
    expect(templateName(getDayPlan(snapshot, date('2026-11-18')))).toBe('Full body B');
    expect(templateName(getDayPlan(snapshot, date('2026-11-20')))).toBe('Full body A');
  });

  it('RN-PLN-03: semana 2 (par) → B el lunes, A el miércoles, B el viernes', () => {
    expect(templateName(getDayPlan(snapshot, date('2026-11-23')))).toBe('Full body B');
    expect(templateName(getDayPlan(snapshot, date('2026-11-25')))).toBe('Full body A');
    expect(templateName(getDayPlan(snapshot, date('2026-11-27')))).toBe('Full body B');
  });

  it('RN-PLN-03: la paridad se cuenta dentro del bloque, no en el programa', () => {
    // Week 4 is even in the program but the first (odd) week of block 2.
    expect(templateName(getDayPlan(snapshot, date('2026-12-07')))).toBe('Torso');
    expect(templateName(getDayPlan(snapshot, date('2026-12-14')))).toBe('Full body A');
  });

  it('RN-PLN-05: series = mínimo del rango × factor, redondeado; nunca menos de 1', () => {
    const week1 = workoutPlan('2026-11-16').plannedItems.map((i) => i.plannedSets);
    const week2 = workoutPlan('2026-11-25').plannedItems.map((i) => i.plannedSets);
    expect(week1).toEqual([2, 1]); // round(3 × 0.7) = 2; max(1, round(2 × 0.7)) = 1
    expect(week2).toEqual([3, 2]);
  });

  it('RN-PLN-05: un .5 sube con Math.round (3 × 0.5 = 1.5 → 2)', () => {
    expect(workoutPlan('2026-12-21').plannedItems[0]?.plannedSets).toBe(2);
  });

  it('RN-PLN-05: nunca menos de 1 serie, aunque el redondeo dé 0', () => {
    const lowFactor: PlanSnapshot = {
      ...snapshot,
      blocks: [{ ...block1, weekFactors: { 1: 0.2 } }, block2, deload],
    };
    const plan = getDayPlan(lowFactor, date('2026-11-16'));
    if (plan.kind !== 'workout') throw new Error('Expected a workout');
    // round(3 × 0.2) = 1; round(2 × 0.2) = 0 → 1
    expect(plan.plannedItems.map((i) => i.plannedSets)).toEqual([1, 1]);
  });

  it('RN-PLN-06: RIR de weekRir, si no el del bloque, y [4, 4] en deload', () => {
    expect(workoutPlan('2026-11-16').plannedItems[0]?.targetRir).toEqual([3, 4]);
    expect(workoutPlan('2026-11-25').plannedItems[0]?.targetRir).toEqual([2, 3]);
    expect(workoutPlan('2026-12-07').plannedItems[0]?.targetRir).toEqual([1, 3]);
    expect(workoutPlan('2026-12-21').plannedItems[0]?.targetRir).toEqual([4, 4]);
  });

  it('RN-PLN-12: el deload usa una plantilla de otro bloque del programa', () => {
    const plan = workoutPlan('2026-12-21');
    expect(plan.template.id).toBe('tpl-c');
    expect(plan.position.block?.id).toBe('block-deload');
  });

  it('RN-PLN-17: los ejercicios salen por order, no por su posición en el arreglo', () => {
    expect(workoutPlan('2026-11-16').plannedItems.map((i) => i.exercise.name)).toEqual([
      'Prensa de piernas',
      'Curl femoral',
    ]);
  });

  it('RN-PLN-18: cada ítem lleva su ejercicio, rango de reps y nota', () => {
    const [prensa, curl] = workoutPlan('2026-11-16').plannedItems;
    expect(prensa).toMatchObject({
      order: 1,
      repRange: [8, 12],
      note: 'Pelvis pegada al respaldo',
    });
    expect(prensa?.exercise.id).toBe('prensa');
    expect(curl).not.toHaveProperty('note');
  });

  it('RN-PLN-11: cada ítem lleva sus alternativas resueltas, en el orden del seed; [] si no hay', () => {
    const [prensa, curl] = workoutPlan('2026-11-16').plannedItems;
    expect(prensa?.alternatives).toEqual([]);
    expect(curl?.alternatives.map((e) => e.id)).toEqual(['curl-tumbado', 'curl-sentado']);
    expect(curl?.alternatives[1]).toEqual(exercises.find((e) => e.id === 'curl-sentado'));
  });

  it('RN-PLN-18: cardio con la nota del calendario; descanso sin nota', () => {
    const tuesday = getDayPlan(snapshot, date('2026-11-17'));
    const thursday = getDayPlan(snapshot, date('2026-11-19'));
    expect(tuesday).toMatchObject({ kind: 'cardio', note: 'Cardio suave 30-40 min' });
    expect(thursday.kind).toBe('rest');
    expect(thursday).not.toHaveProperty('note');
  });

  it('RN-PLN-01: fuera del programa → kind none con su posición', () => {
    expect(getDayPlan(snapshot, date('2026-11-15'))).toEqual({
      kind: 'none',
      position: getPosition(snapshot, date('2026-11-15')),
    });
    expect(getDayPlan(snapshot, date('2026-12-28')).kind).toBe('none');
  });

  it('RN-PLN-16: plantilla, ejercicio o día del calendario inexistentes → lanza', () => {
    const withoutTemplate = { ...snapshot, templates: templates.filter((t) => t.id !== 'tpl-a') };
    const withoutExercise = { ...snapshot, exercises: exercises.filter((e) => e.id !== 'prensa') };
    const withoutMonday: PlanSnapshot = {
      ...snapshot,
      blocks: [
        { ...block1, schedule: block1.schedule.filter((e) => e.weekday !== 1) },
        block2,
        deload,
      ],
    };
    expect(() => getDayPlan(withoutTemplate, date('2026-11-16'))).toThrow();
    expect(() => getDayPlan(withoutExercise, date('2026-11-16'))).toThrow();
    expect(() => getDayPlan(withoutMonday, date('2026-11-16'))).toThrow();
  });

  it('RN-PLN-16: una alternativa inexistente → lanza', () => {
    const withoutAlternative = {
      ...snapshot,
      exercises: exercises.filter((e) => e.id !== 'curl-sentado'),
    };
    expect(() => getDayPlan(withoutAlternative, date('2026-11-16'))).toThrow(/RN-PLN-16/);
  });
});

describe('getWeekPlan', () => {
  it('RN-PLN-10: desde un jueves devuelve los 7 días de su semana, de lunes a domingo', () => {
    const week = getWeekPlan(snapshot, date('2026-11-19'));
    expect(week.map(templateName)).toEqual([
      'Full body A',
      'cardio',
      'Full body B',
      'rest',
      'Full body A',
      'cardio',
      'rest',
    ]);
  });

  it('RN-PLN-10: una semana antes del inicio → 7 días fuera del programa', () => {
    const week = getWeekPlan(snapshot, date('2026-11-12'));
    expect(week).toHaveLength(7);
    expect(week.every((day) => day.kind === 'none')).toBe(true);
  });
});
