import { EXERCISE_CHANGE_SECONDS, setSeconds } from '@/modules/plan';
import type { ID } from '@/shared/kernel';
import { progressOf, type WorkoutProgress } from '../domain/progress';
import type { Exercise, WorkoutView } from './ports';

// Progress of the workout in progress (RN-TRN-20 and 21, spec 003 plan §3). The domain gets the
// seconds of one set as a function; only this layer may import plan (architecture §5.2), so it
// builds it with plan's setSeconds, the chosen exercise of each item (RN-TRN-13) and its repRange.

export function workoutProgress(view: WorkoutView): WorkoutProgress {
  const { workout, exercises } = view;
  const secondsPerSet = (exerciseId: ID): number => {
    const item = workout.items.find((i) => i.exerciseId === exerciseId);
    const exercise: Exercise | undefined = exercises[exerciseId];
    if (!item || !exercise) {
      throw new Error(`Exercise ${exerciseId} missing from the workout view (RN-TRN-17)`);
    }
    return setSeconds(exercise, item.repRange);
  };
  return progressOf(view, secondsPerSet, EXERCISE_CHANGE_SECONDS);
}
