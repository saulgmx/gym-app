import type { Dexie } from 'dexie';
import { ok, type ID } from '@/shared/kernel';
import type { TrainingRepository } from '../application/ports';
import type { SetLog, Workout, WorkoutState } from '../domain/types';

// Training repository over the module's own Dexie tables. Rows are the domain objects as they are.
// Every write is one rw transaction over both tables: IndexedDB serializes them, also across tabs,
// so a check and its write never interleave with another tab (RN-TRN-01, 03). A failing write
// aborts the whole transaction and the promise rejects (RN-TRN-18).
export function createDexieTrainingRepository(db: Dexie): TrainingRepository {
  const workouts = db.table<Workout, ID>('workouts');
  const sets = db.table<SetLog, ID>('sets');
  const tables = [workouts, sets];

  // Only Dexie promises are awaited, so it runs inside a transaction and under useLiveQuery.
  async function stateOf(workoutId: ID): Promise<WorkoutState | undefined> {
    const workout = await workouts.get(workoutId);
    if (!workout) return undefined;
    return { workout, sets: await sets.where('workoutId').equals(workoutId).toArray() };
  }

  return {
    findSet: (setId) => sets.get(setId),

    load: (workoutId) => db.transaction('r', tables, () => stateOf(workoutId)),

    findInProgress: () => workouts.where('status').equals('in_progress').toArray(),

    createIfNoneActive: (workout, newSets) =>
      db.transaction('rw', tables, async () => {
        const active = await workouts.where('status').equals('in_progress').first();
        if (active) return { created: false as const, activeId: active.id };
        await workouts.add(workout);
        await sets.bulkAdd(newSets);
        return { created: true as const };
      }),

    mutate: (workoutId, fn) =>
      db.transaction('rw', tables, async () => {
        const state = await stateOf(workoutId);
        if (!state) return undefined;
        const result = fn(state);
        if (!result.ok) return result; // a domain error writes nothing
        const { changes, value } = result.value;
        if (changes.workout) await workouts.put(changes.workout);
        await sets.bulkDelete(changes.remove);
        await sets.bulkPut(changes.put);
        return ok(value);
      }),

    findCompletedWith: (exerciseId) =>
      db.transaction('r', tables, async () => {
        const own = await sets.where('exerciseId').equals(exerciseId).toArray();
        const ids = [...new Set(own.map((s) => s.workoutId))];
        const completed = (await workouts.bulkGet(ids)).filter(
          (w): w is Workout => w?.status === 'completed',
        );
        const states = await Promise.all(completed.map((w) => stateOf(w.id)));
        return states.filter((s) => s !== undefined);
      }),
  };
}
