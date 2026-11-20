import * as z from 'zod/mini';
import { err, instantSchema, ok, type Result } from '@/shared/kernel';
import type { DataError, Envelope } from '../domain/types';

// Step 2 of the review (RN-DAT-02, contract v1.3): the envelope's shape, with Zod (ADR-0012).
// Each module's `data` is left as is; its port validates it in step 5.

// No eval under the CSP (architecture §7.10); set before the object schemas are built.
z.config({ jitless: true });

const positiveInt = z.int().check(z.minimum(1));

const envelopeSchema = z.strictObject({
  app: z.literal('gym-app'),
  schemaVersion: positiveInt,
  exportedAt: instantSchema,
  modules: z.record(z.string(), z.strictObject({ version: positiveInt, data: z.unknown() })),
});

const notGymApp = (reason: string): Result<never, DataError> =>
  err({ code: 'data/not-gym-app-file', message: `Not a gym-app backup: ${reason} (RN-DAT-02)` });

export function parseEnvelope(text: string): Result<Envelope, DataError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return notGymApp('invalid JSON');
  }
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) {
    const where = parsed.error.issues.map((i) => i.path.map(String).join('.') || '(root)');
    return notGymApp(`envelope does not match at ${where.join(', ')}`);
  }
  const { schemaVersion, exportedAt, modules } = parsed.data;
  return ok({
    schemaVersion,
    exportedAt,
    modules: Object.fromEntries(
      Object.entries(modules).map(([name, m]) => [name, { version: m.version, data: m.data }]),
    ),
  });
}
