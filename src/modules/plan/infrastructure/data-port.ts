import type { Dexie } from 'dexie';
import type { DataPort } from '@/shared/kernel';
import type { PlanSnapshot } from '../domain/schedule';

// Plan backup port (RN-PLN-29). Stub until T6.
export function createPlanDataPort(_db: Dexie): DataPort<PlanSnapshot> {
  const todo = (): never => {
    throw new Error('not implemented');
  };
  return {
    name: 'plan',
    version: 1,
    order: 10,
    tables: [],
    exportData: todo,
    validate: todo,
    describe: todo,
    current: todo,
    importData: todo,
  };
}
