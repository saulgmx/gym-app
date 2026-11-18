import {
  err,
  ok,
  startOfIsoWeek,
  type ID,
  type IdGenerator,
  type Instant,
  type LocalDate,
  type Result,
} from '@/shared/kernel';
import { checkSetValues } from './set-values';
import type {
  ExerciseFacts,
  PlannedSession,
  SetLog,
  TrainingError,
  Workout,
  WorkoutChanges,
  WorkoutItem,
  WorkoutState,
} from './types';

// Workout rules (docs/modules/training.md §6). Pure: time and IDs come in as parameters.

/** RN-TRN-14: the plan day must be in the same ISO week as the day the session starts. */
export function checkPlannedFor(
  date: LocalDate,
  plannedFor: LocalDate,
): Result<void, TrainingError> {
  if (startOfIsoWeek(date) === startOfIsoWeek(plannedFor)) return ok(undefined);
  return err({
    code: 'training/planned-date-out-of-week',
    message: `${plannedFor} is not in the week of ${date} (RN-TRN-14)`,
  });
}

// Missing facts or an exercise outside the workout are bugs: the caller passed the wrong data.
function factsOf(exercises: ExerciseFacts[], exerciseId: ID): ExerciseFacts {
  const exercise = exercises.find((e) => e.id === exerciseId);
  if (!exercise) throw new Error(`Exercise ${exerciseId} missing from exercises`);
  return exercise;
}

// RN-TRN-02: a suggestion that breaks RN-TRN-04, or any weight on reps or time, starts empty.
function prefillFor(exercise: ExerciseFacts, suggested: number | null | undefined): number | null {
  if (suggested === undefined || suggested === null) return null;
  const checked = checkSetValues({ weightKg: suggested, reps: null, rir: null }, exercise, {
    forDone: false,
  });
  return checked.ok ? checked.value.weightKg : null;
}

/** RN-TRN-02, 12: the workout and its empty sets, from the plan of the day. */
export function createWorkout(input: {
  session: PlannedSession;
  date: LocalDate;
  plannedFor: LocalDate;
  now: Instant;
  ids: IdGenerator;
  exercises: ExerciseFacts[]; // at least every main exercise
  prefill: ReadonlyMap<ID, number | null>;
}): { workout: Workout; sets: SetLog[] } {
  const { session, ids } = input;

  // RN-TRN-12: an exercise appears in one item only, as main or alternative.
  const seen = new Set<ID>();
  for (const { exerciseId, alternativeIds } of session.items) {
    for (const option of [exerciseId, ...alternativeIds]) {
      if (seen.has(option)) throw new Error(`Exercise ${option} in two items (RN-TRN-12)`);
      seen.add(option);
    }
  }

  const items = [...session.items]
    .sort((a, b) => a.order - b.order)
    .map((item): WorkoutItem => ({
      exerciseId: item.exerciseId,
      options: [item.exerciseId, ...item.alternativeIds],
      order: item.order,
      plannedSets: item.plannedSets,
      maxSets: item.maxSets,
      repRange: item.repRange,
      targetRir: item.targetRir,
      ...(item.note === undefined ? {} : { note: item.note }),
    }));

  const workout: Workout = {
    id: ids.next(),
    templateId: session.templateId,
    name: session.name,
    programWeek: session.programWeek,
    date: input.date,
    plannedFor: input.plannedFor,
    startedAt: input.now,
    status: 'in_progress',
    items,
  };

  const sets = items.flatMap((item) => {
    const weightKg = prefillFor(
      factsOf(input.exercises, item.exerciseId),
      input.prefill.get(item.exerciseId),
    );
    return Array.from({ length: item.plannedSets }, (_, i): SetLog => ({
      id: ids.next(),
      workoutId: workout.id,
      exerciseId: item.exerciseId,
      setNumber: i + 1,
      weightKg,
      reps: null,
      rir: null,
      done: false,
      isExtra: false,
    }));
  });

  return { workout, sets };
}

// Changes to a workout in progress (RN-TRN-04, 05, 07, 10, 11, 13, 15; decision 8). Each one
// reads the state, returns what to write and the value for the caller, and never writes itself.

type Change<T> = Result<{ changes: WorkoutChanges; value: T }, TrainingError>;

const fail = (
  code: Exclude<
    TrainingError['code'],
    'training/invalid-set-values' | 'training/workout-already-active'
  >,
  message: string,
) => err({ code, message });

const changed = <T>(value: T, put: SetLog[], workout?: Workout): Change<T> =>
  ok({ changes: { ...(workout ? { workout } : {}), put, remove: [] }, value });

// RN-TRN-07: checked before any other error.
function closed({ workout }: WorkoutState) {
  return workout.status === 'in_progress'
    ? undefined
    : fail('training/workout-closed', `Workout ${workout.id} is ${workout.status} (RN-TRN-07)`);
}

function findSet({ sets }: WorkoutState, setId: ID) {
  return sets.find((s) => s.id === setId);
}

const setNotFound = (setId: ID) => fail('training/set-not-found', `Set ${setId} not found`);

// The sets of one exercise, by setNumber.
const setsOf = ({ sets }: WorkoutState, exerciseId: ID) =>
  sets.filter((s) => s.exerciseId === exerciseId).sort((a, b) => a.setNumber - b.setNumber);

function itemOf({ workout }: WorkoutState, exerciseId: ID): WorkoutItem {
  const item = workout.items.find((i) => i.exerciseId === exerciseId);
  if (!item) throw new Error(`Exercise ${exerciseId} is not in workout ${workout.id}`);
  return item;
}

/** RN-TRN-03, 04: an omitted field stays; null clears it; a done set stays valid. */
export function logSetValues(
  state: WorkoutState,
  setId: ID,
  input: { weightKg?: number | null; reps?: number | null; rir?: number | null },
  exercises: ExerciseFacts[],
): Change<SetLog> {
  const isClosed = closed(state);
  if (isClosed) return isClosed;
  const set = findSet(state, setId);
  if (!set) return setNotFound(setId);

  const checked = checkSetValues(
    {
      weightKg: input.weightKg === undefined ? set.weightKg : input.weightKg,
      reps: input.reps === undefined ? set.reps : input.reps,
      rir: input.rir === undefined ? set.rir : input.rir,
    },
    factsOf(exercises, set.exerciseId),
    { forDone: set.done },
  );
  if (!checked.ok) return checked;
  const updated = { ...set, ...checked.value };
  return changed(updated, [updated]);
}

/** RN-TRN-04, 05, 11: mark (with what it requires) or unmark a set. */
export function toggleSetDone(
  state: WorkoutState,
  setId: ID,
  exercises: ExerciseFacts[],
  now: Instant,
): Change<SetLog> {
  const isClosed = closed(state);
  if (isClosed) return isClosed;
  const set = findSet(state, setId);
  if (!set) return setNotFound(setId);

  if (set.done) {
    const updated: SetLog = { ...set, done: false };
    delete updated.completedAt;
    return changed(updated, [updated]);
  }

  const checked = checkSetValues(set, factsOf(exercises, set.exerciseId), { forDone: true });
  if (!checked.ok) return checked;
  const updated: SetLog = { ...set, ...checked.value, done: true, completedAt: now };

  // RN-TRN-11: only when marking, only the next set of the same exercise.
  const next = setsOf(state, set.exerciseId).find((s) => s.setNumber === set.setNumber + 1);
  const inherits = next && !next.done && next.weightKg === null && updated.weightKg !== null;
  return changed(
    updated,
    inherits ? [updated, { ...next, weightKg: updated.weightKg }] : [updated],
  );
}

/** RN-TRN-10: set n + 1, extra, with the weight of the last set, while n < maxSets. */
export function addExtraSet(state: WorkoutState, exerciseId: ID, ids: IdGenerator): Change<SetLog> {
  const isClosed = closed(state);
  if (isClosed) return isClosed;
  const item = itemOf(state, exerciseId);
  const own = setsOf(state, exerciseId);
  if (own.length >= item.maxSets) {
    return fail(
      'training/max-sets-reached',
      `${exerciseId} already has ${String(item.maxSets)} sets (RN-TRN-10)`,
    );
  }

  const added: SetLog = {
    id: ids.next(),
    workoutId: state.workout.id,
    exerciseId,
    setNumber: own.length + 1,
    weightKg: own.at(-1)?.weightKg ?? null,
    reps: null,
    rir: null,
    done: false,
    isExtra: true,
  };
  return changed(added, [added]);
}

/** RN-TRN-10: a set that is not done, never the last one of its exercise; renumbers the rest. */
export function removeSet(state: WorkoutState, setId: ID): Change<void> {
  const isClosed = closed(state);
  if (isClosed) return isClosed;
  const set = findSet(state, setId);
  if (!set) return setNotFound(setId);
  const own = setsOf(state, set.exerciseId);
  if (set.done || own.length <= 1) {
    return fail('training/set-not-removable', `Set ${setId} is done or the only one (RN-TRN-10)`);
  }

  const renumbered = own
    .filter((s) => s.setNumber > set.setNumber)
    .map((s) => ({ ...s, setNumber: s.setNumber - 1 }));
  return ok({ changes: { put: renumbered, remove: [set.id] }, value: undefined });
}

/** RN-TRN-13: switch an item to one of its options while none of its sets is done. */
export function chooseExercise(
  state: WorkoutState,
  fromExerciseId: ID,
  toExerciseId: ID,
  exercises: ExerciseFacts[],
  prefill: number | null,
): Change<Workout> {
  const isClosed = closed(state);
  if (isClosed) return isClosed;
  const item = itemOf(state, fromExerciseId);
  if (fromExerciseId === toExerciseId) return changed(state.workout, []);
  if (!item.options.includes(toExerciseId)) {
    return fail(
      'training/invalid-exercise-choice',
      `${toExerciseId} is not an option of ${fromExerciseId} (RN-TRN-13)`,
    );
  }
  const own = setsOf(state, fromExerciseId);
  if (own.some((s) => s.done)) {
    return fail('training/item-has-done-sets', `${fromExerciseId} has done sets (RN-TRN-13)`);
  }

  const weightKg = prefillFor(factsOf(exercises, toExerciseId), prefill);
  const workout: Workout = {
    ...state.workout,
    items: state.workout.items.map((i) => (i === item ? { ...i, exerciseId: toExerciseId } : i)),
  };
  const put = own.map((s) => ({ ...s, exerciseId: toExerciseId, weightKg, reps: null, rir: null }));
  return changed(workout, put, workout);
}

/** RN-TRN-15: discarded, keeping every set; no finishedAt (that belongs to closing). */
export function discardWorkout(state: WorkoutState): Change<Workout> {
  const isClosed = closed(state);
  if (isClosed) return isClosed;
  const workout: Workout = { ...state.workout, status: 'discarded' };
  return changed(workout, [], workout);
}
