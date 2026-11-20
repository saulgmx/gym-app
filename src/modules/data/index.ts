// Public API of the `data` module (docs/modules/data.md). The only file other modules may import.

import type { Dexie } from 'dexie';
import type { Clock } from '@/shared/kernel';
import { createDataService, type DataApi } from './application/service';
import { parseEnvelope } from './infrastructure/envelope-schema';

// Exports and imports everything through the DataPorts that compose registers (architecture §7.4).
export function createData(deps: { db: Dexie; clock: Clock }): DataApi {
  return createDataService({ ...deps, parseEnvelope });
}

export type { DataApi, PendingImport } from './application/service';
export type {
  DataError,
  DataErrorCode,
  ImportPreview,
  InvalidModuleDataDetails,
  UnsupportedVersionDetails,
} from './domain/types';
