import type { Dexie } from 'dexie';
import type { Clock, DataPort, Result } from '@/shared/kernel';
import type { DataError, ImportPreview } from '../domain/types';

// data's service (docs/modules/data.md §5, contract v1.4). Stub until T12.

export interface PendingImport {
  preview: ImportPreview;
  commit: () => Promise<Result<void, DataError>>; // a property, so the UI can pass it around
}

export interface DataApi {
  registerDataPort<T>(port: DataPort<T>): void;
  exportAll(): Promise<{ filename: string; blob: Blob }>;
  previewImport(file: Blob): Promise<Result<PendingImport, DataError>>;
}

export function createDataService(_deps: { db: Dexie; clock: Clock }): DataApi {
  const todo = (): never => {
    throw new Error('not implemented');
  };
  return { registerDataPort: todo, exportAll: todo, previewImport: todo };
}
