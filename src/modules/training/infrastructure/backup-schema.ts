import * as z from 'zod/mini';
import { idSchema as id, instantSchema, localDateSchema } from '@/shared/kernel';

// Shape of a training backup (RN-TRN-30 (a), ADR-0012): only types and ranges of each value, as
// the app stores rows; RN-TRN-04 depends on the exercise's metric and is not applied here.

// No eval under the CSP (architecture §7.10); set before the object schemas are built.
z.config({ jitless: true });

const natural = z.int().check(z.minimum(0));
const positive = z.int().check(z.minimum(1));
const range = z
  .tuple([natural, natural])
  .check(z.refine(([min, max]) => min <= max, 'Range min must be <= max'));

const item = z.strictObject({
  exerciseId: id,
  options: z.array(id).check(z.minLength(1)),
  order: positive,
  plannedSets: positive,
  maxSets: positive,
  repRange: range,
  targetRir: range,
  note: z.exactOptional(z.string()),
});

const workout = z.strictObject({
  id,
  templateId: z.nullable(id),
  name: z.string(),
  programWeek: z.nullable(positive),
  date: localDateSchema,
  plannedFor: localDateSchema,
  startedAt: instantSchema,
  finishedAt: z.exactOptional(instantSchema),
  status: z.enum(['in_progress', 'completed', 'discarded']),
  items: z.array(item),
  notes: z.exactOptional(z.string()),
});

const set = z.strictObject({
  id,
  workoutId: id,
  exerciseId: id,
  setNumber: positive,
  weightKg: z.nullable(z.number()), // finite; negative = assistance (RN-TRN-04)
  reps: z.nullable(natural),
  rir: z.nullable(natural),
  done: z.boolean(),
  isExtra: z.boolean(),
  completedAt: z.exactOptional(instantSchema),
});

export const trainingBackupSchema = z.strictObject({
  workouts: z.array(workout),
  sets: z.array(set),
});
