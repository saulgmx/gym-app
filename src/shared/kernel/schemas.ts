import * as z from 'zod/mini';
import type { ID, Instant, LocalDate } from './types';

// Primitive schemas for external input: the seed and backups (shared.md §2, ADR-0012).
// No eval: the CSP forbids it (architecture §7.10). Read when object schemas are built, so every
// module that builds them gets it by importing the kernel first.
z.config({ jitless: true });

/** UUIDv7 in lowercase (RN-PLN-24 (b), ADR-0009). */
export const idSchema = z.pipe(
  z.uuidv7().check(z.refine((v) => v === v.toLowerCase(), 'UUID must be lowercase')),
  z.transform((v) => v as ID),
);

/** 'YYYY-MM-DD' of a real date, with no year range. */
export const localDateSchema = z.pipe(
  z.iso.date(),
  z.transform((v) => v as LocalDate),
);

/** ISO 8601 with seconds and an offset ('Z' or '±HH:MM'), as systemClock writes it. */
export const instantSchema = z.pipe(
  z.iso.datetime({ offset: true }),
  z.transform((v) => v as Instant),
);
