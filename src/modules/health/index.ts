// Public API of the `health` module (docs/modules/health.md). The only file other modules may import.

import type { Dexie } from 'dexie';
import type { Clock, DataPort, IdGenerator } from '@/shared/kernel';
import { createHealthService, type HealthApi as HealthServiceApi } from './application/service';
import type { HealthBackup } from './domain/types';
import { createHealthDataPort } from './infrastructure/data-port';
import { createDexiePainRepository } from './infrastructure/dexie-repository';

// The service plus the backup port (RN-HLT-21, spec 007), which lives in infrastructure.
export interface HealthApi extends HealthServiceApi {
  dataPort: DataPort<HealthBackup>;
}

// Wires the application service to Dexie (architecture §5.3). `bus` arrives with the events of §5
// (phase 4), as in training (P-7).
export function createHealth(deps: { db: Dexie; clock: Clock; ids: IdGenerator }): HealthApi {
  const service = createHealthService({
    repository: createDexiePainRepository(deps.db),
    clock: deps.clock,
    ids: deps.ids,
  });
  return { ...service, dataPort: createHealthDataPort(deps.db) };
}

export { healthStores } from './infrastructure/schema';
export { formatRedFlags } from './ui/labels';
export { usePainForWorkouts, usePainSummary } from './ui/hooks';
export { PainNotice } from './ui/PainNotice';
export { PainSelector } from './ui/PainSelector';
export { RedFlagsChecklist } from './ui/RedFlagsChecklist';

export type { PainSummary } from './application/service';
export type { PainGate } from './application/ports';
export type {
  HealthError,
  HealthErrorCode,
  InvalidBackupDetails as HealthBackupErrorDetails,
  NoticeCause,
  PainAssessment,
  PainEntry,
  PainStatus,
  RedFlag,
} from './domain/types';
