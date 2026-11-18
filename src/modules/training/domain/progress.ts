import type { ID } from '@/shared/kernel';
import type { SetLog, WorkoutState } from './types';

// Progress of a workout in progress (RN-TRN-20 and 21, spec 003). Pure. The domain cannot import
// `plan` (architecture §5.2), so the seconds of one set come in as a function and the exercise
// change as a number; the application builds them with plan's duration functions.

export interface WorkoutProgress {
  itemsDone: number; // RN-TRN-21
  itemCount: number;
  items: ('done' | 'current' | 'pending')[]; // one per item, in order
  current: { itemIndex: number; exerciseId: ID; setNumber: number } | null; // itemIndex from 1
  remainingSeconds: number | null; // RN-TRN-20; null when no set is left
  setsDone: number; // text of the discard dialog (AC-23)
  itemsWithDoneSets: number;
}

const isPending = (set: SetLog) => !set.done;

export function progressOf(
  { workout, sets }: WorkoutState,
  setSeconds: (exerciseId: ID) => number,
  changeSeconds: number,
): WorkoutProgress {
  const perItem = workout.items.map((item) => {
    const own = sets.filter((s) => s.exerciseId === item.exerciseId);
    return { item, pending: own.filter(isPending), doneCount: own.filter((s) => s.done).length };
  });

  // RN-TRN-21: the current item is the first with a set left; done = it has sets and none is left.
  const currentIndex = perItem.findIndex((entry) => entry.pending.length > 0);
  const items = perItem.map((entry, index): WorkoutProgress['items'][number] => {
    if (index === currentIndex) return 'current';
    return entry.doneCount > 0 && entry.pending.length === 0 ? 'done' : 'pending';
  });

  const currentEntry = perItem[currentIndex];
  const current = currentEntry
    ? {
        itemIndex: currentIndex + 1,
        exerciseId: currentEntry.item.exerciseId,
        setNumber: Math.min(...currentEntry.pending.map((s) => s.setNumber)),
      }
    : null;

  // RN-TRN-20: pending sets only, plus one exercise change per item that still has any.
  const withPending = perItem.filter((entry) => entry.pending.length > 0);
  const remainingSeconds =
    withPending.length === 0
      ? null
      : withPending.reduce(
          (total, { item, pending }) =>
            total + pending.length * setSeconds(item.exerciseId) + changeSeconds,
          0,
        );

  return {
    itemsDone: items.filter((state) => state === 'done').length,
    itemCount: perItem.length,
    items,
    current,
    remainingSeconds,
    setsDone: perItem.reduce((total, entry) => total + entry.doneCount, 0),
    itemsWithDoneSets: perItem.filter((entry) => entry.doneCount > 0).length,
  };
}
