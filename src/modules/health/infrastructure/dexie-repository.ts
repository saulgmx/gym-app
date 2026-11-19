import type { Dexie } from 'dexie';
import type { ID } from '@/shared/kernel';
import type { PainRepository } from '../application/ports';
import type { PainEntry } from '../domain/types';

// Pain repository over the module's own Dexie table. Rows are the domain objects as they are.
// The table is looked up on each call, not at creation: Dexie throws for a table the database does
// not declare yet, and compose creates health before app/db.ts adds painEntries (spec 005 T6, T7).
export function createDexiePainRepository(db: Dexie): PainRepository {
  const entries = () => db.table<PainEntry, ID>('painEntries');

  return {
    // RN-HLT-09: lookup and write in one rw transaction, serialized across tabs; a failing write
    // aborts it and the promise rejects (RN-HLT-16).
    upsertForWorkout: (workoutId, build) =>
      db.transaction('rw', entries(), async () => {
        const existing = await entries().where('workoutId').equals(workoutId).first();
        const row = build(existing);
        await entries().put(row);
        return row;
      }),

    listAll: () => entries().toArray(),

    existsForWorkout: async (workoutId) =>
      (await entries().where('workoutId').equals(workoutId).count()) > 0,
  };
}
