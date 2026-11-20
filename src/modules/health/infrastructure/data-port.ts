import type { Dexie } from 'dexie';
import type { DataPort } from '@/shared/kernel';
import type { HealthBackup } from '../domain/types';

// Health backup port (RN-HLT-21). Stub until T10.
export function createHealthDataPort(_db: Dexie): DataPort<HealthBackup> {
  const todo = (): never => {
    throw new Error('not implemented');
  };
  return {
    name: 'health',
    version: 1,
    order: 30,
    tables: [],
    exportData: todo,
    validate: todo,
    describe: todo,
    current: todo,
    importData: todo,
  };
}
