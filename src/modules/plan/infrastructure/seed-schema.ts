import { z } from 'zod';
import { err, ok, type ID } from '@/shared/kernel';
import type { SeedParser } from '../application/ports';

// Shape of the plan seed (RN-PLN-24, ADR-0012). Cross-record rules, high risk included,
// are checked afterwards by validateSeed (RN-PLN-07, 15).

const id = z
  .uuidv7()
  .refine((v) => v === v.toLowerCase(), 'UUID must be lowercase') // (b) one spelling per ID
  .transform((v) => v as ID);

const text = z.string().regex(/\S/, 'Text must not be blank'); // (h)
const positiveInt = z.int().min(1); // (c)
const rir = z.int().min(0).max(5); // (d)

// (e)
const range = (value: z.ZodNumber) =>
  z.tuple([value, value]).refine(([min, max]) => min <= max, 'Range min must be <= max');

// (g) JSON object keys are strings; at runtime `record[1]` reads the key "1".
const weekKey = z.string().regex(/^[1-9]\d*$/, 'Week key must be a positive integer');
const byWeek = <T extends z.ZodType>(value: T) =>
  z.record(weekKey, value).transform((r) => r as Record<number, z.output<T>>);

const muscleGroup = z.enum([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
]);

// (a) strictObject everywhere: an unknown key is an error, not silently dropped.
const exercise = z.strictObject({
  id,
  name: text,
  muscleGroup,
  secondaryMuscles: z.array(muscleGroup).exactOptional(),
  equipment: z.enum(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight']),
  metric: z.enum(['weight', 'reps', 'time']),
  lumbarRisk: z.enum(['low', 'medium', 'high']), // (j) RN-PLN-07 rejects 'high'
  isPrimary: z.boolean(),
  beltRecommended: z.boolean().exactOptional(),
  cue: text.exactOptional(),
  restSeconds: range(positiveInt),
});

const weekday = z.literal([0, 1, 2, 3, 4, 5, 6]);

const scheduleEntry = z.discriminatedUnion('kind', [
  z.strictObject({
    weekday,
    kind: z.literal('workout'),
    templateId: id,
    weekParity: z.enum(['odd', 'even']).exactOptional(),
  }),
  z.strictObject({ weekday, kind: z.literal('cardio'), note: text }),
  z.strictObject({ weekday, kind: z.literal('rest') }),
]);

const block = z.strictObject({
  id,
  programId: id,
  name: text,
  startWeek: positiveInt,
  endWeek: positiveInt,
  targetRir: range(rir),
  weekRir: byWeek(range(rir)).exactOptional(),
  weekFactors: byWeek(z.number().gt(0).max(1)), // (f)
  isDeload: z.boolean(),
  schedule: z.array(scheduleEntry).min(1),
});

const templateItem = z.strictObject({
  exerciseId: id,
  alternatives: z.array(id).min(1).exactOptional(),
  order: positiveInt,
  sets: range(positiveInt),
  reps: range(positiveInt),
  note: text.exactOptional(),
});

const template = z.strictObject({
  id,
  blockId: id,
  name: text,
  items: z.array(templateItem).min(1),
});

// (i) every collection has at least one element.
export const planSeedSchema = z.strictObject({
  exercises: z.array(exercise).min(1),
  program: z.strictObject({
    id,
    name: text,
    totalWeeks: positiveInt,
    blockIds: z.array(id).min(1),
  }),
  blocks: z.array(block).min(1),
  templates: z.array(template).min(1),
});

// (k)
export const parseSeed: SeedParser = (raw) => {
  const result = planSeedSchema.safeParse(raw);
  if (result.success) return ok(result.data);
  const issues = result.error.issues.map((i) => ({
    path: i.path.map(String).join('.'),
    code: i.code,
  }));
  return err({
    code: 'plan/invalid-seed',
    message: `Seed does not match the schema (${String(issues.length)} issues)`,
    details: issues,
  });
};
