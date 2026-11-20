import * as z from 'zod/mini';
import { idSchema as id, instantSchema, localDateSchema } from '@/shared/kernel';
import { RED_FLAGS } from '../domain/types';

// Shape of a health backup (RN-HLT-21 (a), ADR-0012): pain entries as the app stores them.

// No eval under the CSP (architecture §7.10); set before the object schemas are built.
z.config({ jitless: true });

const painEntry = z.strictObject({
  id,
  workoutId: id,
  date: localDateSchema,
  recordedAt: instantSchema,
  level: z.int().check(z.minimum(0), z.maximum(10)), // RN-HLT-01
  // (a) any order; a repeated flag is malformed.
  redFlags: z
    .array(z.enum(RED_FLAGS))
    .check(z.refine((flags) => new Set(flags).size === flags.length, 'Red flags must not repeat')),
});

export const healthBackupSchema = z.strictObject({ painEntries: z.array(painEntry) });
