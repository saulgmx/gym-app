// Valid raw seed shared by the schema and integration tests (contract v1.8, plan §6.9).

import type { z } from 'zod';
import type { planSeedSchema } from '../../infrastructure/seed-schema';

// The schema's input type is the JSON shape, so tests can break one field at a time.
export type SeedJson = z.input<typeof planSeedSchema>;

// Fixed UUIDv7 values (version 7, variant 8), checked with z.uuidv7() in Node.
export const uuid = (n: number) => `0196a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
export const PRENSA = uuid(1);
export const PLANCHA = uuid(2);
export const PALLOF = uuid(3);
export const PROGRAM = uuid(10);
export const BLOCK = uuid(20);
export const TPL_A = uuid(30);
export const TPL_B = uuid(31);

// Plain JSON, as it comes from plan-seed.json (weekRir and weekFactors keys are strings).
export const valid = (): SeedJson => ({
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
