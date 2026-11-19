import { Dexie } from 'dexie';
import { healthStores } from '@/modules/health';
import { planStores } from '@/modules/plan';
import { trainingStores } from '@/modules/training';

// The app's only IndexedDB database and the only place that declares db.version(n)
// (architecture §7.3). Version 1 holds the plan tables; version 2 adds training's (spec 002);
// version 3 adds health's painEntries (spec 005).
// Adding tables needs no upgrade function; each module adds its own in a later version.
//
// Synchronous: Dexie opens the database on first use, so a database that cannot open makes the
// first query fail and `ready` rejects (spec 001 plan §5). `indexedDB` is injected by tests.
export function openDatabase({
  indexedDB,
  name = 'gym-app',
}: { indexedDB?: IDBFactory; name?: string } = {}): Dexie {
  const db = new Dexie(name, indexedDB ? { indexedDB } : undefined);
  db.version(1).stores({ ...planStores });
  db.version(2).stores({ ...planStores, ...trainingStores });
  db.version(3).stores({ ...planStores, ...trainingStores, ...healthStores });
  return db;
}
