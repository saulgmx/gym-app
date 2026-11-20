import type { Dexie } from 'dexie';
import type { DataPort } from '@/shared/kernel';
import type { TrainingBackup } from '../domain/types';

// Training backup port (RN-TRN-30). Stub until T8.
export function createTrainingDataPort(_db: Dexie): DataPort<TrainingBackup> {
  const todo = (): never => {
    throw new Error('not implemented');
  };
  return {
    name: 'training',
    version: 1,
    order: 20,
    tables: [],
    exportData: todo,
    validate: todo,
    describe: todo,
    current: todo,
    importData: todo,
  };
}
