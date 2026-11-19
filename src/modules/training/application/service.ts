import {
  compareInstants,
  err,
  ok,
  type Clock,
  type ID,
  type IdGenerator,
  type LocalDate,
  type Result,
} from '@/shared/kernel';
import { exerciseHistory } from '../domain/history';
import { workoutSummary } from '../domain/summary';
import type {
  ExerciseSession,
  PlannedSession,
  SetLog,
  TrainingError,
  Workout,
} from '../domain/types';
import {
  addExtraSet,
  checkFinishable,
  checkPlannedFor,
  chooseExercise,
  createWorkout,
  discardWorkout,
  finishWorkout,
  logSetValues,
  removeSet,
  toggleSetDone,
} from '../domain/workout';
import type {
  ChangeFn,
  Exercise,
  HistoryEntry,
  PainGate,
  PlanReader,
  SuggestionProvider,
  TodayPlan,
  TrainingRepository,
  WorkoutView,
} from './ports';

// Use cases of the training module (docs/modules/training.md §4, phase 2 operations).
// Everything async that is not training's own storage (plan, suggestions, the clock) is read
// before repository.mutate, whose transaction cannot wait on foreign promises (plan §5).

export interface TrainingApi {
  startWorkout(
    date: LocalDate,
    opts?: { plannedFor?: LocalDate },
  ): Promise<Result<Workout, TrainingError>>;
  logSet(
    setId: ID,
    input: { weightKg?: number | null; reps?: number | null; rir?: number | null },
  ): Promise<Result<SetLog, TrainingError>>;
  toggleSetDone(setId: ID): Promise<Result<SetLog, TrainingError>>;
  addExtraSet(workoutId: ID, exerciseId: ID): Promise<Result<SetLog, TrainingError>>;
  removeSet(setId: ID): Promise<Result<void, TrainingError>>;
  chooseExercise(
    workoutId: ID,
    fromExerciseId: ID,
    toExerciseId: ID,
  ): Promise<Result<Workout, TrainingError>>;
  discardWorkout(workoutId: ID): Promise<Result<void, TrainingError>>;
  getActiveWorkout(): Promise<Workout | undefined>;
  getWorkout(id: ID): Promise<Workout | undefined>;
  getWorkoutView(id: ID): Promise<WorkoutView | undefined>;
  // RN-TRN-01 picks the active one; RN-TRN-17 builds its view (spec 003, "Hoy" in D2).
  getActiveWorkoutView(): Promise<WorkoutView | undefined>;
  getExerciseHistory(
    exerciseId: ID,
    opts?: { limit?: number; before?: LocalDate },
  ): Promise<ExerciseSession[]>;
  finishWorkout(workoutId: ID, input: { notes?: string }): Promise<Result<Workout, TrainingError>>; // RN-TRN-22
  listWorkouts(range: { from: LocalDate; to: LocalDate }): Promise<Workout[]>; // RN-TRN-26
  listWorkoutHistory(): Promise<HistoryEntry[]>; // RN-TRN-28 (spec 006): every completed one
}

const workoutNotFound = (workoutId: ID) =>
  err<TrainingError>({
    code: 'training/workout-not-found',
    message: `Workout ${workoutId} not found`,
  });
const setNotFound = (setId: ID) =>
  err<TrainingError>({ code: 'training/set-not-found', message: `Set ${setId} not found` });

const optionsOf = (workout: Workout): ID[] => workout.items.flatMap((i) => i.options);

// LocalDate (YYYY-MM-DD) sorts as a string; an Instant never does (ADR-0009).
const byDateDesc = (a: LocalDate, b: LocalDate): number => Number(a < b) - Number(a > b);

// The plan of a workout day as the domain takes it; maxSets comes from the template (RN-TRN-10).
function plannedSession(today: Extract<TodayPlan, { kind: 'workout' }>): PlannedSession {
  const { position, template, plannedItems } = today;
  if (position.week === null) throw new Error('A workout day has a program week (RN-PLN-01)');
  return {
    templateId: template.id,
    name: template.name,
    programWeek: position.week,
    items: plannedItems.map((item) => {
      const templateItem = template.items.find((t) => t.order === item.order);
      if (!templateItem) throw new Error(`No template item with order ${String(item.order)}`);
      return {
        exerciseId: item.exercise.id,
        alternativeIds: item.alternatives.map((a) => a.id),
        order: item.order,
        plannedSets: item.plannedSets,
        maxSets: templateItem.sets[1],
        repRange: item.repRange,
        targetRir: item.targetRir,
        ...(item.note === undefined ? {} : { note: item.note }),
      };
    }),
  };
}

export function createTrainingService(deps: {
  repository: TrainingRepository;
  plan: PlanReader;
  suggestions: SuggestionProvider;
  painGate: PainGate;
  clock: Clock;
  ids: IdGenerator;
}): TrainingApi {
  const { repository, plan, suggestions, painGate, clock, ids } = deps;

  // RN-TRN-16: a failing provider never blocks a session.
  async function prefillOf(exerciseId: ID): Promise<number | null> {
    try {
      return (await suggestions.getPrefill(exerciseId))?.weightKg ?? null;
    } catch (error) {
      console.error(`[training] suggestion for ${exerciseId} failed (RN-TRN-16)`, error);
      return null;
    }
  }

  async function mutate<T>(workoutId: ID, fn: ChangeFn<T>): Promise<Result<T, TrainingError>> {
    return (await repository.mutate(workoutId, fn)) ?? workoutNotFound(workoutId);
  }

  // Facts of every option, read before the transaction; mutate re-reads the workout, so an
  // alternative chosen in another tab between both reads is still covered.
  async function onSet<T>(
    setId: ID,
    change: (exercises: Exercise[]) => ChangeFn<T>,
  ): Promise<Result<T, TrainingError>> {
    const set = await repository.findSet(setId);
    if (!set) return setNotFound(setId);
    const state = await repository.load(set.workoutId);
    if (!state) return workoutNotFound(set.workoutId);
    const exercises = await plan.getExercises(optionsOf(state.workout));
    return mutate(set.workoutId, change(exercises));
  }

  // RN-TRN-01: with broken data, the most recently started one.
  async function activeWorkout(): Promise<Workout | undefined> {
    const active = await repository.findInProgress();
    return active.sort((a, b) => compareInstants(b.startedAt, a.startedAt))[0];
  }

  // RN-TRN-17
  async function workoutView(id: ID): Promise<WorkoutView | undefined> {
    const state = await repository.load(id);
    if (!state) return undefined;
    const { workout, sets } = state;

    const wanted = [...new Set(optionsOf(workout))];
    const found = await plan.getExercises(wanted);
    const missing = wanted.find((w) => !found.some((e) => e.id === w));
    if (missing) throw new Error(`Exercise ${missing} missing from plan (RN-TRN-17)`);

    const orderOf = new Map(workout.items.map((i) => [i.exerciseId, i.order]));
    const position = (s: SetLog) => orderOf.get(s.exerciseId) ?? Number.POSITIVE_INFINITY;
    return {
      workout,
      sets: [...sets].sort((a, b) => position(a) - position(b) || a.setNumber - b.setNumber),
      exercises: Object.fromEntries(found.map((e) => [e.id, e])),
    };
  }

  return {
    // RN-TRN-14 order: week, plan of the day, then RN-TRN-01 inside the transaction.
    async startWorkout(date, opts = {}) {
      const plannedFor = opts.plannedFor ?? date;
      const week = checkPlannedFor(date, plannedFor);
      if (!week.ok) return week;

      const today = await plan.getTodayPlan(plannedFor);
      if (today.kind !== 'workout') {
        return err({
          code: 'training/no-plan-today',
          message: `${plannedFor} is not a workout day (RN-TRN-14)`,
        });
      }

      const mains = today.plannedItems.map((i) => i.exercise.id);
      const prefills = await Promise.all(mains.map(prefillOf));
      const { workout, sets } = createWorkout({
        session: plannedSession(today),
        date,
        plannedFor,
        now: clock.now(),
        ids,
        exercises: today.plannedItems.flatMap((i) => [i.exercise, ...i.alternatives]),
        prefill: new Map(mains.map((id, i) => [id, prefills[i] ?? null])),
      });

      const created = await repository.createIfAllowed(workout, sets);
      if (created.created) return ok(workout);
      if (created.reason === 'active') {
        return err({
          code: 'training/workout-already-active',
          message: `Workout ${created.activeId} is in progress (RN-TRN-01)`,
          details: { workoutId: created.activeId },
        });
      }
      if (created.reason === 'done') {
        return err({
          code: 'training/already-done',
          message: `${plannedFor} is already done (RN-TRN-24)`,
        });
      }
      return err({
        code: 'training/day-already-trained',
        message: `${date} already has a completed workout (RN-TRN-27)`,
      });
    },

    logSet: (setId, input) =>
      onSet(setId, (exercises) => (state) => logSetValues(state, setId, input, exercises)),

    toggleSetDone(setId) {
      const now = clock.now();
      return onSet(setId, (exercises) => (state) => toggleSetDone(state, setId, exercises, now));
    },

    addExtraSet: (workoutId, exerciseId) =>
      mutate(workoutId, (state) => addExtraSet(state, exerciseId, ids)),

    async removeSet(setId) {
      const set = await repository.findSet(setId);
      if (!set) return setNotFound(setId);
      return mutate(set.workoutId, (state) => removeSet(state, setId));
    },

    async chooseExercise(workoutId, fromExerciseId, toExerciseId) {
      const [exercises, prefill] = await Promise.all([
        plan.getExercises([toExerciseId]),
        prefillOf(toExerciseId),
      ]);
      return mutate(workoutId, (state) =>
        chooseExercise(state, fromExerciseId, toExerciseId, exercises, prefill),
      );
    },

    async discardWorkout(workoutId) {
      const result = await mutate(workoutId, discardWorkout);
      return result.ok ? ok(undefined) : result;
    },

    getActiveWorkout: activeWorkout,

    getWorkout: async (id) => (await repository.load(id))?.workout,

    getWorkoutView: workoutView,

    async getActiveWorkoutView() {
      const active = await activeWorkout();
      return active ? workoutView(active.id) : undefined;
    },

    getExerciseHistory: async (exerciseId, opts) =>
      exerciseHistory(await repository.findCompletedWith(exerciseId), exerciseId, opts),

    // RN-TRN-22: PainGate is asked before the transaction, which cannot wait on health, and only
    // when the workout can be closed; mutate checks everything again in case another tab closed it.
    async finishWorkout(workoutId, { notes }) {
      const state = await repository.load(workoutId);
      if (!state) return workoutNotFound(workoutId);
      const finishable = checkFinishable(state);
      if (!finishable.ok) return finishable;
      const hasPain = await painGate.hasPainEntry(workoutId);
      const now = clock.now();
      return mutate(workoutId, (current) =>
        finishWorkout(current, { ...(notes === undefined ? {} : { notes }), now, hasPain }),
      );
    },

    // RN-TRN-26: latest first, by date and then by startedAt as an instant (ADR-0009).
    listWorkouts: async ({ from, to }) =>
      (await repository.findCompletedBetween(from, to)).sort(
        (a, b) => byDateDesc(a.date, b.date) || compareInstants(b.startedAt, a.startedAt),
      ),

    // RN-TRN-28: the order of RN-TRN-26. now = startedAt: a completed workout has finishedAt, so
    // the result is the same; broken data without it reads 0 min, and the clock is not involved.
    listWorkoutHistory: async () =>
      (await repository.findCompletedStates())
        .sort(
          (a, b) =>
            byDateDesc(a.workout.date, b.workout.date) ||
            compareInstants(b.workout.startedAt, a.workout.startedAt),
        )
        .map((state) => ({
          workout: state.workout,
          summary: workoutSummary(state, state.workout.startedAt),
        })),
  };
}
