import { describe, expect, it } from 'vitest';
import type { ID } from '@/shared/kernel';
import { validateSeed } from '../domain/seed-rules';
import type { Exercise, PlanErrorCode, PlanSeed, ScheduleEntry } from '../domain/types';

// A small valid seed; every test breaks it in exactly one way (RN-PLN-07, 11, 15, 19).

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

const fullWeek = (monday: ScheduleEntry[]): ScheduleEntry[] => [
  ...monday,
  { weekday: 2, kind: 'cardio', note: 'Cardio suave' },
  { weekday: 3, kind: 'rest' },
  { weekday: 4, kind: 'rest' },
  { weekday: 5, kind: 'rest' },
  { weekday: 6, kind: 'rest' },
  { weekday: 0, kind: 'rest' },
];

const base = (): PlanSeed => ({
  exercises: [
    exercise('dominadas', { muscleGroup: 'back', equipment: 'bodyweight' }),
    exercise('jalon', { muscleGroup: 'back', equipment: 'cable' }),
    exercise('hack-squat', { lumbarRisk: 'medium' }),
    exercise('plancha', { muscleGroup: 'core', metric: 'time' }),
    exercise('pallof-isometrico', { muscleGroup: 'core', metric: 'time' }),
  ],
  program: { id: id('program'), name: 'Prueba', totalWeeks: 3, blockIds: [id('b1'), id('b2')] },
  blocks: [
    {
      id: id('b1'),
      programId: id('program'),
      name: 'Bloque 1',
      startWeek: 1,
      endWeek: 2,
      targetRir: [2, 3],
      weekRir: { 1: [3, 4] },
      weekFactors: { 1: 0.7 },
      isDeload: false,
      schedule: fullWeek([
        { weekday: 1, kind: 'workout', templateId: id('tpl-a'), weekParity: 'odd' },
        { weekday: 1, kind: 'workout', templateId: id('tpl-b'), weekParity: 'even' },
      ]),
    },
    {
      id: id('b2'),
      programId: id('program'),
      name: 'Descarga',
      startWeek: 3,
      endWeek: 3,
      targetRir: [4, 4],
      weekFactors: {},
      isDeload: true,
      schedule: fullWeek([{ weekday: 1, kind: 'workout', templateId: id('tpl-a') }]),
    },
  ],
  templates: [
    {
      id: id('tpl-a'),
      blockId: id('b1'),
      name: 'A',
      items: [
        {
          exerciseId: id('dominadas'),
          alternatives: [id('jalon')],
          order: 1,
          sets: [3, 3],
          reps: [6, 10],
        },
        { exerciseId: id('hack-squat'), order: 2, sets: [3, 3], reps: [8, 12] },
      ],
    },
    {
      id: id('tpl-b'),
      blockId: id('b1'),
      name: 'B',
      items: [
        {
          exerciseId: id('plancha'),
          alternatives: [id('pallof-isometrico')],
          order: 1,
          sets: [3, 3],
          reps: [30, 45],
        },
      ],
    },
  ],
});

const deadlift = exercise('peso-muerto-rumano', {
  name: 'Peso muerto rumano',
  muscleGroup: 'hamstrings',
  equipment: 'barbell',
  lumbarRisk: 'high',
});

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Fixture element missing');
  return value;
}

// Returns a broken copy of the base seed; the mutator edits it in place.
function broken(mutate: (seed: PlanSeed) => void): PlanSeed {
  const seed = base();
  mutate(seed);
  return seed;
}

function expectError(seed: PlanSeed, code: PlanErrorCode) {
  const result = validateSeed(seed);
  expect(result.ok).toBe(false);
  if (result.ok) return undefined;
  expect(result.error.code).toBe(code);
  return result.error;
}

const templateA = (seed: PlanSeed) => must(seed.templates[0]);
const block1 = (seed: PlanSeed) => must(seed.blocks[0]);
const firstItem = (seed: PlanSeed) => must(templateA(seed).items[0]);

describe('validateSeed', () => {
  it('acepta el seed válido de referencia (con un ejercicio medium)', () => {
    expect(validateSeed(base())).toEqual({ ok: true, value: undefined });
  });

  describe('RN-PLN-07: ningún ejercicio high', () => {
    it('high como ejercicio principal → plan/high-risk-exercise con sus IDs', () => {
      const error = expectError(
        broken((s) => {
          s.exercises.push(deadlift);
          firstItem(s).exerciseId = deadlift.id;
        }),
        'plan/high-risk-exercise',
      );
      expect(error?.details).toMatchObject({ exerciseId: 'peso-muerto-rumano' });
    });

    it('high como alternativa → plan/high-risk-exercise', () => {
      expectError(
        broken((s) => {
          s.exercises.push(deadlift);
          firstItem(s).alternatives = [deadlift.id];
        }),
        'plan/high-risk-exercise',
      );
    });

    it('high solo en el catálogo, sin plantilla que lo use → plan/high-risk-exercise', () => {
      expectError(
        broken((s) => s.exercises.push(deadlift)),
        'plan/high-risk-exercise',
      );
    });
  });

  describe('RN-PLN-19: orden de los errores', () => {
    it('un high y una referencia rota → gana la seguridad', () => {
      expectError(
        broken((s) => {
          s.exercises.push(deadlift);
          must(templateA(s).items[1]).exerciseId = id('no-existe');
        }),
        'plan/high-risk-exercise',
      );
    });
  });

  describe('RN-PLN-15 (a): referencias', () => {
    it('ejercicio de una plantilla inexistente → plan/invalid-seed con sus IDs', () => {
      const error = expectError(
        broken((s) => {
          firstItem(s).exerciseId = id('no-existe');
        }),
        'plan/invalid-seed',
      );
      expect(error?.details).toMatchObject({ templateId: 'tpl-a', exerciseId: 'no-existe' });
    });

    it('plantilla del calendario inexistente → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          block1(s).schedule[0] = {
            weekday: 1,
            kind: 'workout',
            templateId: id('no-existe'),
            weekParity: 'odd',
          };
        }),
        'plan/invalid-seed',
      );
    });

    it('bloque de una plantilla inexistente → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          templateA(s).blockId = id('no-existe');
        }),
        'plan/invalid-seed',
      );
    });
  });

  describe('RN-PLN-15 (b): semanas', () => {
    it('hueco entre bloques → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          block1(s).endWeek = 1;
          block1(s).weekRir = {};
        }),
        'plan/invalid-seed',
      );
    });

    it('bloques solapados → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          must(s.blocks[1]).startWeek = 2;
        }),
        'plan/invalid-seed',
      );
    });

    it('bloque más allá de totalWeeks → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          must(s.blocks[1]).endWeek = 4;
        }),
        'plan/invalid-seed',
      );
    });

    it('semanas sin cubrir al final → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          s.program.totalWeeks = 4;
        }),
        'plan/invalid-seed',
      );
    });
  });

  describe('RN-PLN-15 (c): calendario', () => {
    it('un día sin entrada → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          block1(s).schedule = block1(s).schedule.filter((e) => e.weekday !== 4);
        }),
        'plan/invalid-seed',
      );
    });

    it('dos entradas sin paridad el mismo día → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          block1(s).schedule.push({ weekday: 4, kind: 'rest' });
        }),
        'plan/invalid-seed',
      );
    });

    it('paridad incompleta (solo odd) → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          block1(s).schedule = block1(s).schedule.filter(
            (e) => !(e.kind === 'workout' && e.weekParity === 'even'),
          );
        }),
        'plan/invalid-seed',
      );
    });

    it('dos entradas odd el mismo día → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          block1(s).schedule[1] = {
            weekday: 1,
            kind: 'workout',
            templateId: id('tpl-b'),
            weekParity: 'odd',
          };
        }),
        'plan/invalid-seed',
      );
    });
  });

  describe('RN-PLN-11 / RN-PLN-15 (d): alternativas', () => {
    it('alternativa inexistente → plan/invalid-seed por referencia rota, con su ID', () => {
      const error = expectError(
        broken((s) => {
          firstItem(s).alternatives = [id('no-existe')];
        }),
        'plan/invalid-seed',
      );
      // Reported as a missing reference (a), not as a metric mismatch (d).
      expect(error?.details).toMatchObject({ templateId: 'tpl-a', exerciseId: 'no-existe' });
    });

    it('alternativa igual al principal → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          firstItem(s).alternatives = [id('dominadas')];
        }),
        'plan/invalid-seed',
      );
    });

    it('alternativa repetida → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          firstItem(s).alternatives = [id('jalon'), id('jalon')];
        }),
        'plan/invalid-seed',
      );
    });

    it('alternativa con otra métrica → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          firstItem(s).alternatives = [id('plancha')];
        }),
        'plan/invalid-seed',
      );
    });
  });

  describe('RN-PLN-15 (e): IDs únicos por tabla', () => {
    it('dos ejercicios con el mismo ID → plan/invalid-seed', () => {
      expectError(
        broken((s) => s.exercises.push(exercise('jalon', { name: 'Otro jalón' }))),
        'plan/invalid-seed',
      );
    });

    it('dos plantillas con el mismo ID → plan/invalid-seed', () => {
      expectError(
        broken((s) => s.templates.push({ ...templateA(s), name: 'Copia' })),
        'plan/invalid-seed',
      );
    });

    it('dos bloques con el mismo ID → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          must(s.blocks[1]).id = id('b1');
          s.program.blockIds = [id('b1'), id('b1')];
        }),
        'plan/invalid-seed',
      );
    });
  });

  describe('RN-PLN-15 (f): programa y bloques', () => {
    it('bloque de otro programa → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          must(s.blocks[1]).programId = id('otro');
        }),
        'plan/invalid-seed',
      );
    });

    it('blockIds sin un bloque del seed → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          s.program.blockIds = [id('b1')];
        }),
        'plan/invalid-seed',
      );
    });

    it('blockIds con un bloque inexistente → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          s.program.blockIds = [id('b1'), id('b2'), id('b3')];
        }),
        'plan/invalid-seed',
      );
    });

    it('blockIds fuera del orden de startWeek → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          s.program.blockIds = [id('b2'), id('b1')];
        }),
        'plan/invalid-seed',
      );
    });
  });

  describe('RN-PLN-15 (g): semanas de weekRir y weekFactors', () => {
    it('weekFactors con una semana de otro bloque → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          block1(s).weekFactors = { 3: 0.7 };
        }),
        'plan/invalid-seed',
      );
    });

    it('weekRir con una semana de otro bloque → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          block1(s).weekRir = { 3: [3, 4] };
        }),
        'plan/invalid-seed',
      );
    });

    it('weekFactors con una semana anterior al bloque → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          must(s.blocks[1]).weekFactors = { 1: 0.7 }; // block 2 covers week 3 only
        }),
        'plan/invalid-seed',
      );
    });
  });

  describe('RN-PLN-15 (h): order único por plantilla', () => {
    it('dos ítems con el mismo order → plan/invalid-seed', () => {
      expectError(
        broken((s) => {
          must(templateA(s).items[1]).order = 1;
        }),
        'plan/invalid-seed',
      );
    });
  });

  describe('RN-PLN-15 (i): un ejercicio en un solo ítem por plantilla', () => {
    const secondItem = (seed: PlanSeed) => must(templateA(seed).items[1]);

    it('la alternativa de un ítem es el principal de otro → plan/invalid-seed con sus IDs', () => {
      const error = expectError(
        broken((s) => {
          secondItem(s).exerciseId = id('jalon');
        }),
        'plan/invalid-seed',
      );
      expect(error?.details).toEqual({ templateId: 'tpl-a', exerciseId: 'jalon' });
    });

    it('la alternativa de un ítem es la alternativa de otro → plan/invalid-seed', () => {
      const error = expectError(
        broken((s) => {
          secondItem(s).alternatives = [id('jalon')];
        }),
        'plan/invalid-seed',
      );
      expect(error?.details).toEqual({ templateId: 'tpl-a', exerciseId: 'jalon' });
    });

    it('el mismo principal en dos ítems → plan/invalid-seed', () => {
      const error = expectError(
        broken((s) => {
          secondItem(s).exerciseId = id('dominadas');
        }),
        'plan/invalid-seed',
      );
      expect(error?.details).toEqual({ templateId: 'tpl-a', exerciseId: 'dominadas' });
    });

    it('el mismo ejercicio en plantillas distintas es válido', () => {
      const seed = broken((s) => {
        must(must(s.templates[1]).items[0]).order = 1;
        must(s.templates[1]).items.push({
          exerciseId: id('dominadas'),
          order: 2,
          sets: [3, 3],
          reps: [6, 10],
        });
      });
      expect(validateSeed(seed)).toEqual({ ok: true, value: undefined });
    });

    it('RN-PLN-19: con un order repetido y un ejercicio repetido → gana (h)', () => {
      const error = expectError(
        broken((s) => {
          secondItem(s).order = 1;
          secondItem(s).exerciseId = id('dominadas');
        }),
        'plan/invalid-seed',
      );
      expect(error?.details).toEqual({ templateId: 'tpl-a' });
    });
  });
});
