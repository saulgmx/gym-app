// Public API of the `data` module (docs/modules/data.md). The only file other modules may import.
// Phase 0 skeleton: dependencies and operations arrive with their features.

export type DataApi = Record<string, never>;

export function createData(): DataApi {
  return {};
}

export type {
  DataError,
  DataErrorCode,
  ImportPreview,
  InvalidModuleDataDetails,
  UnsupportedVersionDetails,
} from './domain/types';
