import type { Result } from '@/shared/kernel';
import type { PlanSnapshot } from '../domain/schedule';
import type { PlanError, PlanSeed } from '../domain/types';

// What the application service needs from outside (spec 001, plan §6.9).

// Shape of the raw seed; the Zod schema implements it (ADR-0012). Fails with plan/invalid-seed.
export type SeedParser = (raw: unknown) => Result<PlanSeed, PlanError>;

export interface PlanRepository {
  loadSnapshot(): Promise<PlanSnapshot | undefined>; // undefined when no program is stored
  // Checks "empty" and writes in the same transaction (RN-PLN-14).
  seedIfEmpty(snapshot: PlanSnapshot): Promise<void>;
}
