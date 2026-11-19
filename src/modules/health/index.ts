// Public API of the `health` module (docs/modules/health.md). The only file other modules may import.

import type { Dexie } from 'dexie';
import type { Clock, IdGenerator } from '@/shared/kernel';
import { createHealthService, type HealthApi } from './application/service';
import { createDexiePainRepository } from './infrastructure/dexie-repository';

// Wires the application service to Dexie (architecture §5.3). `bus` arrives with the events of §5
// (phase 4), as in training (P-7).
export function createHealth(deps: { db: Dexie; clock: Clock; ids: IdGenerator }): HealthApi {
  return createHealthService({
    repository: createDexiePainRepository(deps.db),
    clock: deps.clock,
    ids: deps.ids,
  });
}

export { healthStores } from './infrastructure/schema';
export { usePainSummary } from './ui/hooks';
export { PainNotice } from './ui/PainNotice';
export { PainSelector } from './ui/PainSelector';
export { RedFlagsChecklist } from './ui/RedFlagsChecklist';

export type { HealthApi, PainSummary } from './application/service';
export type { PainGate } from './application/ports';
export type {
  HealthError,
  HealthErrorCode,
  NoticeCause,
  PainAssessment,
  PainEntry,
  PainStatus,
  RedFlag,
} from './domain/types';
