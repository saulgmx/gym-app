import type { ID } from '@/shared/kernel';
import type { TrainingRepository } from '../../application/ports';
import type { SetLog, Workout, WorkoutState } from '../../domain/types';

// In-memory TrainingRepository for service tests (QS-08). It applies changes the way the Dexie
// repository does inside its transaction: read the state, call the domain, write what it returns.

export function memoryRepository(initial: WorkoutState[] = []) {
  const workouts = new Map<ID, Workout>();
  const sets = new Map<ID, SetLog>();
  const add = ({ workout, sets: own }: WorkoutState) => {
    workouts.set(workout.id, structuredClone(workout));
    for (const set of own) sets.set(set.id, structuredClone(set));
  };
  initial.forEach(add);

  const stateOf = (workout: Workout): WorkoutState => ({
    workout: structuredClone(workout),
    sets: [...sets.values()]
      .filter((s) => s.workoutId === workout.id)
      .map((s) => structuredClone(s)),
  });

  const repository: TrainingRepository = {
    findSet: (setId) => Promise.resolve(structuredClone(sets.get(setId))),
    load: (workoutId) => {
      const workout = workouts.get(workoutId);
      return Promise.resolve(workout && stateOf(workout));
    },
    findInProgress: () =>
      Promise.resolve(
        [...workouts.values()]
          .filter((w) => w.status === 'in_progress')
          .map((w) => structuredClone(w)),
      ),
    // RN-TRN-01, then RN-TRN-24, as the Dexie transaction checks them.
    createIfAllowed: (workout, newSets) => {
      const all = [...workouts.values()];
      const active = all.find((w) => w.status === 'in_progress');
      if (active) {
        return Promise.resolve({ created: false, reason: 'active', activeId: active.id });
      }
      if (all.some((w) => w.status === 'completed' && w.plannedFor === workout.plannedFor)) {
        return Promise.resolve({ created: false, reason: 'done' });
      }
      add({ workout, sets: newSets });
      return Promise.resolve({ created: true });
    },
    findCompletedBetween: (from, to) =>
      Promise.resolve(
        [...workouts.values()]
          .filter((w) => w.status === 'completed' && from <= w.date && w.date <= to)
          .map((w) => structuredClone(w)),
      ),
    mutate: (workoutId, fn) => {
      const workout = workouts.get(workoutId);
      if (!workout) return Promise.resolve(undefined);
      const result = fn(stateOf(workout));
      if (!result.ok) return Promise.resolve(result);
      const { changes, value } = result.value;
      if (changes.workout) workouts.set(changes.workout.id, structuredClone(changes.workout));
      for (const set of changes.put) sets.set(set.id, structuredClone(set));
      for (const setId of changes.remove) sets.delete(setId);
      return Promise.resolve({ ok: true, value });
    },
    findCompletedWith: (exerciseId) =>
      Promise.resolve(
        [...workouts.values()]
          .filter((w) => w.status === 'completed')
          .map(stateOf)
          .filter(({ sets: own }) => own.some((s) => s.exerciseId === exerciseId)),
      ),
  };

  return { repository, workouts, sets, add };
}
