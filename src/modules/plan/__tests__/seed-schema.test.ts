import { describe, expect, it } from 'vitest';
import { parseSeed } from '../infrastructure/seed-schema';

// Shape of the seed (RN-PLN-24, ADR-0012). Every case changes one field of a valid raw seed.
// Cross-record rules (references, weeks, high risk) belong to validateSeed, not to the schema.

// Fixed UUIDv7 values (version 7, variant 8), checked with z.uuidv7() in Node.
const uuid = (n: number) => `0196a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const PRENSA = uuid(1);
const PLANCHA = uuid(2);
const PALLOF = uuid(3);
const PROGRAM = uuid(10);
const BLOCK = uuid(20);
const TPL_A = uuid(30);
const TPL_B = uuid(31);

// Plain JSON, as it comes from plan-seed.json (weekRir and weekFactors keys are strings).
const valid = () => ({
  exercises: [
    {
      id: PRENSA,
      name: 'Prensa de piernas',
      muscleGroup: 'quads',
      secondaryMuscles: ['glutes'],
      equipment: 'machine',
      metric: 'weight',
      lumbarRisk: 'low',
      isPrimary: true,
      beltRecommended: true,
      cue: 'Espalda pegada al respaldo',
      restSeconds: [120, 180],
    },
    {
      id: PLANCHA,
      name: 'Plancha',
      muscleGroup: 'core',
      equipment: 'bodyweight',
      metric: 'time',
      lumbarRisk: 'low',
      isPrimary: false,
      restSeconds: [60, 90],
    },
    {
      id: PALLOF,
      name: 'Pallof press isométrico',
      muscleGroup: 'core',
      equipment: 'cable',
      metric: 'time',
      lumbarRisk: 'medium',
      isPrimary: false,
      restSeconds: [60, 90],
    },
  ],
  program: { id: PROGRAM, name: 'Hipertrofia', totalWeeks: 2, blockIds: [BLOCK] },
  blocks: [
    {
      id: BLOCK,
      programId: PROGRAM,
      name: 'Bloque 1 · Full body',
      startWeek: 1,
      endWeek: 2,
      targetRir: [2, 3],
      weekRir: { '1': [3, 4] },
      weekFactors: { '1': 0.7 },
      isDeload: false,
      schedule: [
        { weekday: 1, kind: 'workout', templateId: TPL_A, weekParity: 'odd' },
        { weekday: 1, kind: 'workout', templateId: TPL_B, weekParity: 'even' },
        { weekday: 2, kind: 'cardio', note: 'Cardio suave' },
        { weekday: 3, kind: 'workout', templateId: TPL_B },
        { weekday: 4, kind: 'rest' },
        { weekday: 5, kind: 'rest' },
        { weekday: 6, kind: 'rest' },
        { weekday: 0, kind: 'rest' },
      ],
    },
  ],
  templates: [
    {
      id: TPL_A,
      blockId: BLOCK,
      name: 'Full body A',
      items: [
        { exerciseId: PRENSA, order: 1, sets: [3, 3], reps: [8, 12], note: 'Pies bajos' },
        { exerciseId: PLANCHA, alternatives: [PALLOF], order: 2, sets: [2, 3], reps: [30, 45] },
      ],
    },
    {
      id: TPL_B,
      blockId: BLOCK,
      name: 'Full body B',
      items: [{ exerciseId: PRENSA, order: 1, sets: [2, 2], reps: [10, 12] }],
    },
  ],
});

type Path = (string | number)[];

// Returns a copy of the valid seed with one value replaced (or removed with `remove`).
const remove = Symbol('remove');
function withValue(path: Path, value: unknown): unknown {
  const seed: unknown = structuredClone(valid());
  let node = seed as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
  const last = path.at(-1);
  if (last === undefined) throw new Error('Empty path');
  if (value === remove) Reflect.deleteProperty(node, last);
  else node[last] = value;
  return seed;
}

function expectInvalid(raw: unknown, issuePath: string) {
  const result = parseSeed(raw);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe('plan/invalid-seed');
  const paths = (result.error.details as { path: string; code: string }[]).map((i) => i.path);
  expect(paths).toContain(issuePath);
}

describe('parseSeed', () => {
  it('acepta el seed válido de referencia y lo devuelve igual', () => {
    expect(parseSeed(valid())).toEqual({ ok: true, value: valid() });
  });

  it.each([
    ['null', null],
    ['un arreglo', []],
    ['un texto', 'seed'],
  ])('rechaza %s como seed', (_, raw) => {
    expectInvalid(raw, '');
  });

  it('RN-PLN-24 (k): details lista cada problema con su ruta y su código de Zod', () => {
    const result = parseSeed(withValue(['templates', 0, 'items', 0, 'sets'], [3, 'tres']));
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'plan/invalid-seed',
        details: [{ path: 'templates.0.items.0.sets.1', code: 'invalid_type' }],
      },
    });
  });

  describe('forma y enums', () => {
    it.each<[string, Path, unknown, string]>([
      [
        'falta un campo obligatorio',
        ['exercises', 0, 'equipment'],
        remove,
        'exercises.0.equipment',
      ],
      [
        'muscleGroup fuera del enum',
        ['exercises', 0, 'muscleGroup'],
        'legs',
        'exercises.0.muscleGroup',
      ],
      ['metric fuera del enum', ['exercises', 1, 'metric'], 'seconds', 'exercises.1.metric'],
      [
        'secondaryMuscles fuera del enum',
        ['exercises', 0, 'secondaryMuscles'],
        ['arms'],
        'exercises.0.secondaryMuscles.0',
      ],
      ['isPrimary no booleano', ['exercises', 0, 'isPrimary'], 'yes', 'exercises.0.isPrimary'],
      ['weekday 7', ['blocks', 0, 'schedule', 4, 'weekday'], 7, 'blocks.0.schedule.4.weekday'],
      [
        'weekday no entero',
        ['blocks', 0, 'schedule', 4, 'weekday'],
        1.5,
        'blocks.0.schedule.4.weekday',
      ],
      [
        'kind desconocido',
        ['blocks', 0, 'schedule', 4, 'kind'],
        'swim',
        'blocks.0.schedule.4.kind',
      ],
      [
        'weekParity fuera del enum',
        ['blocks', 0, 'schedule', 0, 'weekParity'],
        'impar',
        'blocks.0.schedule.0.weekParity',
      ],
      [
        'workout sin templateId',
        ['blocks', 0, 'schedule', 3, 'templateId'],
        remove,
        'blocks.0.schedule.3.templateId',
      ],
      ['cardio sin nota', ['blocks', 0, 'schedule', 2, 'note'], remove, 'blocks.0.schedule.2.note'],
      [
        'rango con tres valores',
        ['templates', 0, 'items', 0, 'reps'],
        [8, 10, 12],
        'templates.0.items.0.reps',
      ],
    ])('%s → plan/invalid-seed', (_, path, value, issuePath) => {
      expectInvalid(withValue(path, value), issuePath);
    });
  });

  describe('RN-PLN-24 (a): claves desconocidas', () => {
    it.each<[string, Path, string]>([
      ['en la raíz', [], ''],
      ['en un ejercicio', ['exercises', 0], 'exercises.0'],
      ['en el programa', ['program'], 'program'],
      [
        'en una entrada del calendario (errata de weekParity)',
        ['blocks', 0, 'schedule', 0],
        'blocks.0.schedule.0',
      ],
      ['en una entrada de descanso', ['blocks', 0, 'schedule', 4], 'blocks.0.schedule.4'],
      ['en un ítem de plantilla', ['templates', 0, 'items', 0], 'templates.0.items.0'],
    ])('%s → plan/invalid-seed', (_, path, issuePath) => {
      const seed = structuredClone(valid()) as unknown as Record<string | number, unknown>;
      let node = seed;
      for (const key of path) node = node[key] as Record<string | number, unknown>;
      node.weekParty = 'odd';
      expectInvalid(seed, issuePath);
    });
  });

  describe('RN-PLN-24 (b): IDs UUIDv7 en minúsculas', () => {
    it.each<[string, Path, unknown, string]>([
      ['un ID que no es UUID', ['exercises', 0, 'id'], 'prensa', 'exercises.0.id'],
      [
        'un UUID versión 4',
        ['program', 'id'],
        '0196a000-0000-4000-8000-000000000010',
        'program.id',
      ],
      [
        'un UUIDv7 en mayúsculas',
        ['blocks', 0, 'id'],
        '0196A000-0000-7000-8000-00000000001A',
        'blocks.0.id',
      ],
      [
        'una referencia que no es UUID',
        ['templates', 0, 'items', 1, 'alternatives'],
        ['pallof'],
        'templates.0.items.1.alternatives.0',
      ],
      [
        'un blockId del programa que no es UUID',
        ['program', 'blockIds'],
        ['bloque-1'],
        'program.blockIds.0',
      ],
    ])('%s → plan/invalid-seed', (_, path, value, issuePath) => {
      expectInvalid(withValue(path, value), issuePath);
    });
  });

  describe('RN-PLN-24 (c): enteros ≥ 1', () => {
    it.each<[string, Path, unknown, string]>([
      ['sets con 0', ['templates', 0, 'items', 0, 'sets'], [0, 3], 'templates.0.items.0.sets.0'],
      [
        'reps con decimales',
        ['templates', 0, 'items', 0, 'reps'],
        [8, 12.5],
        'templates.0.items.0.reps.1',
      ],
      [
        'restSeconds negativo',
        ['exercises', 0, 'restSeconds'],
        [-60, 90],
        'exercises.0.restSeconds.0',
      ],
      ['startWeek 0', ['blocks', 0, 'startWeek'], 0, 'blocks.0.startWeek'],
      ['endWeek con decimales', ['blocks', 0, 'endWeek'], 2.5, 'blocks.0.endWeek'],
      ['totalWeeks 0', ['program', 'totalWeeks'], 0, 'program.totalWeeks'],
      ['order 0', ['templates', 0, 'items', 0, 'order'], 0, 'templates.0.items.0.order'],
    ])('%s → plan/invalid-seed', (_, path, value, issuePath) => {
      expectInvalid(withValue(path, value), issuePath);
    });
  });

  describe('RN-PLN-24 (d): RIR entero de 0 a 5', () => {
    it('acepta RIR 0 y 5', () => {
      expect(parseSeed(withValue(['blocks', 0, 'targetRir'], [0, 5])).ok).toBe(true);
    });

    it.each<[string, Path, unknown, string]>([
      ['targetRir negativo', ['blocks', 0, 'targetRir'], [-1, 2], 'blocks.0.targetRir.0'],
      ['targetRir mayor que 5', ['blocks', 0, 'targetRir'], [2, 6], 'blocks.0.targetRir.1'],
      [
        'weekRir con decimales',
        ['blocks', 0, 'weekRir'],
        { '1': [3, 3.5] },
        'blocks.0.weekRir.1.1',
      ],
    ])('%s → plan/invalid-seed', (_, path, value, issuePath) => {
      expectInvalid(withValue(path, value), issuePath);
    });
  });

  describe('RN-PLN-24 (e): rangos con min ≤ max', () => {
    it('acepta min = max', () => {
      expect(parseSeed(withValue(['exercises', 0, 'restSeconds'], [90, 90])).ok).toBe(true);
    });

    it.each<[string, Path, unknown, string]>([
      ['sets', ['templates', 0, 'items', 0, 'sets'], [3, 2], 'templates.0.items.0.sets'],
      ['reps', ['templates', 0, 'items', 0, 'reps'], [12, 8], 'templates.0.items.0.reps'],
      ['restSeconds', ['exercises', 0, 'restSeconds'], [180, 120], 'exercises.0.restSeconds'],
      ['targetRir', ['blocks', 0, 'targetRir'], [3, 2], 'blocks.0.targetRir'],
      ['weekRir', ['blocks', 0, 'weekRir'], { '1': [4, 3] }, 'blocks.0.weekRir.1'],
    ])('%s invertido → plan/invalid-seed', (_, path, value, issuePath) => {
      expectInvalid(withValue(path, value), issuePath);
    });
  });

  describe('RN-PLN-24 (f): weekFactors en (0, 1]', () => {
    it('acepta un factor de 1', () => {
      expect(parseSeed(withValue(['blocks', 0, 'weekFactors'], { '1': 1 })).ok).toBe(true);
    });

    it.each([
      ['0', 0],
      ['negativo', -0.5],
      ['mayor que 1', 1.2],
    ])('factor %s → plan/invalid-seed', (_, factor) => {
      expectInvalid(
        withValue(['blocks', 0, 'weekFactors'], { '1': factor }),
        'blocks.0.weekFactors.1',
      );
    });
  });

  describe('RN-PLN-24 (g): claves de semana', () => {
    it.each([
      ['0', 'weekFactors', { '0': 0.7 }],
      ['no numérica', 'weekFactors', { uno: 0.7 }],
      ['con decimales', 'weekRir', { '1.5': [3, 4] }],
      ['con cero a la izquierda', 'weekRir', { '01': [3, 4] }],
    ])('clave %s en %s → plan/invalid-seed', (_, field, value) => {
      const result = parseSeed(withValue(['blocks', 0, field], value));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const paths = (result.error.details as { path: string }[]).map((i) => i.path);
        expect(paths.some((p) => p.startsWith(`blocks.0.${field}`))).toBe(true);
      }
    });
  });

  describe('RN-PLN-24 (h): textos no vacíos', () => {
    it.each<[string, Path, unknown, string]>([
      ['nombre vacío', ['exercises', 0, 'name'], '', 'exercises.0.name'],
      ['nombre solo con espacios', ['program', 'name'], '   ', 'program.name'],
      ['nombre de bloque vacío', ['blocks', 0, 'name'], '', 'blocks.0.name'],
      ['nombre de plantilla vacío', ['templates', 0, 'name'], ' ', 'templates.0.name'],
      ['nota de ítem vacía', ['templates', 0, 'items', 0, 'note'], '', 'templates.0.items.0.note'],
      ['cue vacío', ['exercises', 0, 'cue'], ' ', 'exercises.0.cue'],
      [
        'nota de cardio vacía',
        ['blocks', 0, 'schedule', 2, 'note'],
        '',
        'blocks.0.schedule.2.note',
      ],
    ])('%s → plan/invalid-seed', (_, path, value, issuePath) => {
      expectInvalid(withValue(path, value), issuePath);
    });
  });

  describe('RN-PLN-24 (i): arreglos no vacíos', () => {
    it.each<[string, Path, string]>([
      ['exercises', ['exercises'], 'exercises'],
      ['blocks', ['blocks'], 'blocks'],
      ['templates', ['templates'], 'templates'],
      ['items', ['templates', 0, 'items'], 'templates.0.items'],
      ['blockIds', ['program', 'blockIds'], 'program.blockIds'],
      ['schedule', ['blocks', 0, 'schedule'], 'blocks.0.schedule'],
      [
        'alternatives',
        ['templates', 0, 'items', 1, 'alternatives'],
        'templates.0.items.1.alternatives',
      ],
    ])('%s vacío → plan/invalid-seed', (_, path, issuePath) => {
      expectInvalid(withValue(path, []), issuePath);
    });
  });

  it('RN-PLN-24 (j): un ejercicio high pasa el esquema (lo rechaza RN-PLN-07)', () => {
    expect(parseSeed(withValue(['exercises', 0, 'lumbarRisk'], 'high')).ok).toBe(true);
  });
});
