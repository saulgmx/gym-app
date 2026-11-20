import * as z from 'zod/mini';
import { err, idSchema as id, ok } from '@/shared/kernel';
import type { SeedParser } from '../application/ports';

// Shape of the plan seed (RN-PLN-24, ADR-0012). Cross-record rules, high risk included,
// are checked afterwards by validateSeed (RN-PLN-07, 15). zod/mini keeps the initial bundle
// under budget (spec 002 plan §6.9): the same checks, written as functions.

// No eval: the CSP forbids it (architecture §7.10), and Zod's `new Function` probe is reported as
// a violation even when caught. The kernel sets it too; repeated here so this file never depends
// on import order.
z.config({ jitless: true });

// (b) UUIDv7 in lowercase: idSchema from the kernel (spec 007 plan §6.6).

const text = z.string().check(z.regex(/\S/, 'Text must not be blank')); // (h)
const positiveInt = z.int().check(z.minimum(1)); // (c)
const rir = z.int().check(z.minimum(0), z.maximum(5)); // (d)

// (e)
const range = (value: z.ZodMiniNumber) =>
  z.tuple([value, value]).check(z.refine(([min, max]) => min <= max, 'Range min must be <= max'));

// (g) JSON object keys are strings; at runtime `record[1]` reads the key "1".
const weekKey = z.string().check(z.regex(/^[1-9]\d*$/, 'Week key must be a positive integer'));
const byWeek = <T extends z.ZodMiniType>(value: T) =>
  z.pipe(
    z.record(weekKey, value),
    z.transform((r) => r as Record<number, z.output<T>>),
  );

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
  secondaryMuscles: z.exactOptional(z.array(muscleGroup)),
  equipment: z.enum(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight']),
  metric: z.enum(['weight', 'reps', 'time']),
  lumbarRisk: z.enum(['low', 'medium', 'high']), // (j) RN-PLN-07 rejects 'high'
  isPrimary: z.boolean(),
  beltRecommended: z.exactOptional(z.boolean()),
  cue: z.exactOptional(text),
  restSeconds: range(positiveInt),
});

const weekday = z.literal([0, 1, 2, 3, 4, 5, 6]);

const scheduleEntry = z.discriminatedUnion('kind', [
  z.strictObject({
    weekday,
    kind: z.literal('workout'),
    templateId: id,
    weekParity: z.exactOptional(z.enum(['odd', 'even'])),
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
  weekRir: z.exactOptional(byWeek(range(rir))),
  weekFactors: byWeek(z.number().check(z.gt(0), z.maximum(1))), // (f)
  isDeload: z.boolean(),
  schedule: z.array(scheduleEntry).check(z.minLength(1)),
});

const templateItem = z.strictObject({
  exerciseId: id,
  alternatives: z.exactOptional(z.array(id).check(z.minLength(1))),
  order: positiveInt,
  sets: range(positiveInt),
  reps: range(positiveInt),
  note: z.exactOptional(text),
});

const template = z.strictObject({
  id,
  blockId: id,
  name: text,
  items: z.array(templateItem).check(z.minLength(1)),
});

// (i) every collection has at least one element.
export const planSeedSchema = z.strictObject({
  exercises: z.array(exercise).check(z.minLength(1)),
  program: z.strictObject({
    id,
    name: text,
    totalWeeks: positiveInt,
    blockIds: z.array(id).check(z.minLength(1)),
  }),
  blocks: z.array(block).check(z.minLength(1)),
  templates: z.array(template).check(z.minLength(1)),
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
