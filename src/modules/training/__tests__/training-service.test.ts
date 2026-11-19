import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixedClock, sequentialIds, type ID, type Instant, type LocalDate } from '@/shared/kernel';
import type {
  Exercise,
  PainGate,
  PlanReader,
  ProgramPosition,
  SessionTemplate,
  SuggestionProvider,
  TodayPlan,
} from '../application/ports';
import { createTrainingService } from '../application/service';
import type { SetLog, Workout, WorkoutState } from '../domain/types';
import { memoryRepository } from './fixtures/memory-repository';

// Application service with an in-memory repository and a fake plan (QS-08; contract v1.7).
// Dates checked with Node: 2026-11-16 Monday … 20 Friday, 21 Saturday, 23 next Monday.

const date = (s: string) => s as LocalDate;
const id = (s: string) => s as ID;
const instant = (s: string) => s as Instant;
const saturday = fixedClock('2026-11-21T09:30:00-06:00');

const exercise = (key: string, overrides: Partial<Exercise> = {}): Exercise => ({
  id: id(key),
  name: key,
  muscleGroup: 'quads',
  equipment: 'machine',
  metric: 'weight',
  lumbarRisk: 'low',
  isPrimary: false,
  restSeconds: [60, 90],
  ...overrides,
});
const catalog: Exercise[] = [
  exercise('prensa', { name: 'Prensa de piernas' }),
  exercise('dominadas', { muscleGroup: 'back', equipment: 'bodyweight' }),
  exercise('jalon', { muscleGroup: 'back', equipment: 'cable' }),
  exercise('dead-bug', { muscleGroup: 'core', equipment: 'bodyweight', metric: 'reps' }),
];
const byId = (key: string) => {
  const found = catalog.find((e) => e.id === key);
  if (!found) throw new Error(key);
  return found;
};

const position: ProgramPosition = {
  status: 'active',
  startDate: date('2026-11-16'),
  totalWeeks: 15,
  week: 1,
  block: null,
  isDeloadWeek: false,
  volumeFactor: 0.7,
};

const template: SessionTemplate = {
  id: id('tpl-a'),
  blockId: id('block-1'),
  name: 'Full body A',
  items: [
    { exerciseId: id('prensa'), order: 1, sets: [3, 3], reps: [8, 12], note: 'Pies bajos' },
    {
      exerciseId: id('dominadas'),
      alternatives: [id('jalon')],
      order: 2,
      sets: [2, 3],
      reps: [6, 10],
    },
    { exerciseId: id('dead-bug'), order: 3, sets: [2, 2], reps: [8, 10] },
  ],
};

const workoutDay: TodayPlan = {
  kind: 'workout',
  position,
  template,
  plannedItems: [
    {
      exercise: byId('prensa'),
      alternatives: [],
      order: 1,
      plannedSets: 2,
      repRange: [8, 12],
      targetRir: [3, 4],
      note: 'Pies bajos',
    },
    {
      exercise: byId('dominadas'),
      alternatives: [byId('jalon')],
      order: 2,
      plannedSets: 1,
      repRange: [6, 10],
      targetRir: [3, 4],
    },
    {
      exercise: byId('dead-bug'),
      alternatives: [],
      order: 3,
      plannedSets: 1,
      repRange: [8, 10],
      targetRir: [3, 4],
    },
  ],
};

// Friday 20 and Monday 16 are workout days; Tuesday 17 is cardio; the rest are rest days.
function fakePlan(missing: string[] = []) {
  const plan = {
    getTodayPlan: vi.fn((d: LocalDate): Promise<TodayPlan> => {
      if (d === '2026-11-16' || d === '2026-11-20') return Promise.resolve(workoutDay);
      if (d === '2026-11-17') return Promise.resolve({ kind: 'cardio', position, note: 'Suave' });
      return Promise.resolve({ kind: 'rest', position });
    }),
    getExercises: vi.fn((ids: ID[]) =>
      Promise.resolve(catalog.filter((e) => ids.includes(e.id) && !missing.includes(e.id))),
    ),
  } satisfies PlanReader;
  return plan;
}

function setup(
  options: {
    initial?: WorkoutState[];
    suggestions?: SuggestionProvider;
    missing?: string[];
    painGate?: PainGate;
  } = {},
) {
  const store = memoryRepository(options.initial);
  const plan = fakePlan(options.missing);
  const suggestions = options.suggestions ?? { getPrefill: vi.fn(() => Promise.resolve(null)) };
  // A pain entry exists unless the test says otherwise (RN-TRN-06).
  const hasPainEntry = vi.fn<PainGate['hasPainEntry']>(() => Promise.resolve(true));
  const painGate = options.painGate ?? { hasPainEntry };
  const service = createTrainingService({
    repository: store.repository,
    plan,
    suggestions,
    painGate,
    clock: saturday,
    ids: sequentialIds('id'),
  });
  return { service, store, plan, suggestions, hasPainEntry };
}

const expectOk = <T>(result: { ok: true; value: T } | { ok: false; error: { code: string } }) => {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}`);
  return result.value;
};

// Starts Friday's session on Saturday and returns the workout and its sets by key.
async function started(options: Parameters<typeof setup>[0] = {}) {
  const ctx = setup(options);
  const workout = expectOk(
    await ctx.service.startWorkout(date('2026-11-21'), { plannedFor: date('2026-11-20') }),
  );
  // Reads the store each time: chooseExercise changes the exerciseId of the sets.
  const setOf = (exerciseId: string, n = 1) => {
    const found = [...ctx.store.sets.values()].find(
      (s) => s.exerciseId === exerciseId && s.setNumber === n,
    );
    if (!found) throw new Error(`${exerciseId} ${String(n)}`);
    return found.id;
  };
  return { ...ctx, workout, setOf };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startWorkout', () => {
  it('RN-TRN-02: crea el workout con la instantánea y lo guarda (AC-1)', async () => {
    const { service, store } = setup();

    const workout = expectOk(await service.startWorkout(date('2026-11-16')));

    expect(workout).toMatchObject({
      templateId: 'tpl-a',
      name: 'Full body A',
      programWeek: 1,
      date: '2026-11-16',
      plannedFor: '2026-11-16',
      startedAt: '2026-11-21T09:30:00-06:00',
      status: 'in_progress',
    });
    expect(workout.items.map((i) => [i.exerciseId, i.plannedSets, i.maxSets])).toEqual([
      ['prensa', 2, 3],
      ['dominadas', 1, 3],
      ['dead-bug', 1, 2],
    ]);
    expect(workout.items[1]?.options).toEqual(['dominadas', 'jalon']);
    expect(workout.items[0]?.note).toBe('Pies bajos');
    expect(store.workouts.get(workout.id)).toEqual(workout);
    expect(store.sets.size).toBe(4);
  });

  it('RN-TRN-14: otra sesión de la semana usa el plan de plannedFor (AC-8)', async () => {
    const { workout, plan } = await started();
    expect(workout).toMatchObject({ date: '2026-11-21', plannedFor: '2026-11-20' });
    expect(plan.getTodayPlan).toHaveBeenCalledWith('2026-11-20');
  });

  it('RN-TRN-14: plannedFor de otra semana → error sin pedir el plan (AC-10)', async () => {
    const { service, plan, store } = setup();
    const result = await service.startWorkout(date('2026-11-21'), {
      plannedFor: date('2026-11-23'),
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'training/planned-date-out-of-week' },
    });
    expect(plan.getTodayPlan).not.toHaveBeenCalled();
    expect(store.workouts.size).toBe(0);
  });

  it('RN-TRN-14: un día sin pesas → training/no-plan-today, sin crear nada (AC-3, AC-10)', async () => {
    const { service, store } = setup();
    for (const d of ['2026-11-17', '2026-11-19']) {
      const result = await service.startWorkout(date(d));
      expect(result, d).toMatchObject({ ok: false, error: { code: 'training/no-plan-today' } });
    }
    expect(store.workouts.size).toBe(0);
  });

  it('RN-TRN-01: con una sesión activa → already-active con su id; queda una (AC-2)', async () => {
    const { service, store, workout } = await started();

    const result = await service.startWorkout(date('2026-11-16'));

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'training/workout-already-active',
        details: { workoutId: workout.id },
      }) as unknown,
    });
    expect([...store.workouts.values()].filter((w) => w.status === 'in_progress')).toHaveLength(1);
  });

  it('RN-TRN-14: orden semana → plan del día → sesión activa', async () => {
    const { service } = await started();
    expect(await service.startWorkout(date('2026-11-19'))).toMatchObject({
      error: { code: 'training/no-plan-today' },
    });
  });

  it('RN-TRN-02: el prellenado sale del SuggestionProvider por ejercicio principal', async () => {
    const getPrefill = vi.fn((exerciseId: ID) =>
      Promise.resolve(
        exerciseId === 'prensa' ? { weightKg: 60, message: '', tone: 'up' as const } : null,
      ),
    );
    const { store } = await started({ suggestions: { getPrefill } });
    expect(getPrefill.mock.calls.map(([e]) => e).sort()).toEqual([
      'dead-bug',
      'dominadas',
      'prensa',
    ]);
    const prensa = [...store.sets.values()].filter((s) => s.exerciseId === 'prensa');
    expect(prensa.map((s) => s.weightKg)).toEqual([60, 60]);
  });

  it('RN-TRN-16: un proveedor que rechaza cuenta como null y se registra', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const getPrefill = vi.fn(() => Promise.reject(new Error('boom')));

    const { store } = await started({ suggestions: { getPrefill } });

    expect([...store.sets.values()].every((s) => s.weightKg === null)).toBe(true);
    expect(error).toHaveBeenCalled();
  });
});

describe('operaciones sobre las series', () => {
  it('RN-TRN-03: logSet guarda el cambio y lo devuelve (AC-12)', async () => {
    const { service, store, setOf } = await started();
    const set = expectOk(await service.logSet(setOf('prensa'), { weightKg: 60 }));
    expect(set.weightKg).toBe(60);
    expect(store.sets.get(set.id)).toEqual(set);
  });

  it('RN-TRN-04: un valor inválido no se guarda', async () => {
    const { service, store, setOf } = await started();
    const result = await service.logSet(setOf('prensa'), { weightKg: 60.1 });
    expect(result).toMatchObject({ ok: false, error: { code: 'training/invalid-set-values' } });
    expect(store.sets.get(setOf('prensa'))?.weightKg).toBeNull();
  });

  it('RN-TRN-04: valida con el ejercicio elegido (asistencia no vale en Jalón)', async () => {
    const { service, workout, setOf } = await started();
    expect((await service.logSet(setOf('dominadas'), { weightKg: -20 })).ok).toBe(true);
    expectOk(await service.chooseExercise(workout.id, id('dominadas'), id('jalon')));
    expect(await service.logSet(setOf('jalon'), { weightKg: -20 })).toMatchObject({
      error: { details: { field: 'weightKg', reason: 'not-allowed' } },
    });
  });

  it('si otra pestaña elige la alternativa entre las dos lecturas, valida con el ejercicio nuevo', async () => {
    const { service, store, workout, setOf } = await started();
    const dominadas = setOf('dominadas');
    const load = store.repository.load.bind(store.repository);
    // The other tab switches the item right after this tab reads the workout.
    vi.spyOn(store.repository, 'load').mockImplementationOnce(async (workoutId) => {
      const state = await load(workoutId);
      await store.repository.mutate(workout.id, (st) => {
        const item = st.workout.items[1];
        if (!item) throw new Error('item');
        const switched = {
          ...st.workout,
          items: st.workout.items.map((i) => (i === item ? { ...i, exerciseId: id('jalon') } : i)),
        };
        const put = st.sets
          .filter((x) => x.exerciseId === 'dominadas')
          .map((x) => ({ ...x, exerciseId: id('jalon') }));
        return {
          ok: true,
          value: { changes: { workout: switched, put, remove: [] }, value: undefined },
        };
      });
      return state;
    });

    expect(await service.logSet(dominadas, { weightKg: -20 })).toMatchObject({
      error: { details: { field: 'weightKg', reason: 'not-allowed' } },
    });
  });

  it('una serie inexistente → training/set-not-found', async () => {
    const { service } = await started();
    for (const result of [
      await service.logSet(id('no-existe'), { reps: 1 }),
      await service.toggleSetDone(id('no-existe')),
      await service.removeSet(id('no-existe')),
    ]) {
      expect(result).toMatchObject({ ok: false, error: { code: 'training/set-not-found' } });
    }
  });

  it('RN-TRN-05, 11: toggleSetDone marca con clock.now() y la siguiente hereda (AC-13)', async () => {
    const { service, store, setOf } = await started();
    await service.logSet(setOf('prensa'), { weightKg: 60, reps: 10 });

    const set = expectOk(await service.toggleSetDone(setOf('prensa')));

    expect(set).toMatchObject({ done: true, completedAt: '2026-11-21T09:30:00-06:00' });
    expect(store.sets.get(setOf('prensa', 2))?.weightKg).toBe(60);
  });

  it('RN-TRN-10: addExtraSet y removeSet guardan sus cambios', async () => {
    const { service, store, workout, setOf } = await started();
    const extra = expectOk(await service.addExtraSet(workout.id, id('prensa')));
    expect(store.sets.get(extra.id)).toMatchObject({ setNumber: 3, isExtra: true });

    expectOk(await service.removeSet(setOf('prensa', 2)));
    expect(store.sets.get(extra.id)?.setNumber).toBe(2);
  });

  it('un workout inexistente → training/workout-not-found', async () => {
    const { service } = await started();
    for (const result of [
      await service.addExtraSet(id('no-existe'), id('prensa')),
      await service.chooseExercise(id('no-existe'), id('dominadas'), id('jalon')),
      await service.discardWorkout(id('no-existe')),
    ]) {
      expect(result).toMatchObject({ ok: false, error: { code: 'training/workout-not-found' } });
    }
  });
});

describe('chooseExercise', () => {
  it('RN-TRN-13: cambia y prellena con la sugerencia del ejercicio nuevo (AC-23)', async () => {
    const getPrefill = vi.fn((exerciseId: ID) =>
      Promise.resolve(
        exerciseId === 'jalon' ? { weightKg: 45, message: '', tone: 'up' as const } : null,
      ),
    );
    const { service, store, workout } = await started({ suggestions: { getPrefill } });

    const updated = expectOk(
      await service.chooseExercise(workout.id, id('dominadas'), id('jalon')),
    );

    expect(updated.items[1]?.exerciseId).toBe('jalon');
    expect(store.workouts.get(workout.id)).toEqual(updated);
    const jalon = [...store.sets.values()].filter((s) => s.exerciseId === 'jalon');
    expect(jalon.map((s) => s.weightKg)).toEqual([45]);
  });

  it('RN-TRN-16: si el proveedor rechaza, el peso queda vacío', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const getPrefill = vi.fn(() => Promise.reject(new Error('boom')));
    const { service, store, workout } = await started({ suggestions: { getPrefill } });

    expectOk(await service.chooseExercise(workout.id, id('dominadas'), id('jalon')));

    expect([...store.sets.values()].find((s) => s.exerciseId === 'jalon')?.weightKg).toBeNull();
  });
});

describe('discardWorkout y getActiveWorkout', () => {
  it('RN-TRN-15: descartar deja iniciar otra; después todo es workout-closed (AC-34, AC-35)', async () => {
    const { service, workout, setOf } = await started();

    expectOk(await service.discardWorkout(workout.id));

    expect(await service.getActiveWorkout()).toBeUndefined();
    expect(await service.logSet(setOf('prensa'), { reps: 1 })).toMatchObject({
      error: { code: 'training/workout-closed' },
    });
    expect((await service.startWorkout(date('2026-11-20'))).ok).toBe(true);
  });

  it('RN-TRN-01: sin sesión activa → undefined', async () => {
    expect(await setup().service.getActiveWorkout()).toBeUndefined();
  });

  it('RN-TRN-01: con una sesión activa → esa (AC-4)', async () => {
    const { service, workout } = await started();
    expect(await service.getActiveWorkout()).toEqual(workout);
  });

  it('RN-TRN-01: con varias in_progress (dato roto) → la de startedAt más reciente', async () => {
    const at = (key: string, startedAt: string): WorkoutState => ({
      workout: { ...stored(key, 'in_progress', '2026-11-20'), startedAt: instant(startedAt) },
      sets: [],
    });
    const { service } = setup({
      initial: [
        at('a', '2026-11-20T08:00:00-06:00'),
        at('b', '2026-11-20T18:00:00-06:00'),
        at('c', '2026-11-20T10:00:00-06:00'),
      ],
    });
    expect((await service.getActiveWorkout())?.id).toBe('b');
  });
});

// Stored workouts for queries: one item per exercise key, sets given by the test.
function stored(key: string, status: Workout['status'], d: string, exerciseIds = ['prensa']) {
  return {
    id: id(key),
    templateId: id('tpl-a'),
    name: 'Full body A',
    programWeek: 1,
    date: date(d),
    plannedFor: date(d),
    startedAt: instant(`${d}T09:00:00-06:00`),
    status,
    items: exerciseIds.map((e, i) => ({
      exerciseId: id(e),
      options: e === 'dominadas' ? [id('dominadas'), id('jalon')] : [id(e)],
      order: i + 1,
      plannedSets: 2,
      maxSets: 3,
      repRange: [8 + i, 12] as [number, number],
      targetRir: [3, 4] as [number, number],
    })),
  } satisfies Workout;
}

const doneSet = (
  key: string,
  workoutId: string,
  exerciseId: string,
  setNumber: number,
  v: Partial<SetLog> = {},
): SetLog => ({
  id: id(key),
  workoutId: id(workoutId),
  exerciseId: id(exerciseId),
  setNumber,
  weightKg: 60,
  reps: 10,
  rir: 2,
  done: true,
  isExtra: false,
  completedAt: instant('2026-11-09T09:10:00-06:00'),
  ...v,
});

describe('getWorkout y getWorkoutView', () => {
  it('getWorkout → el workout o undefined', async () => {
    const { service, workout } = await started();
    expect(await service.getWorkout(workout.id)).toEqual(workout);
    expect(await service.getWorkout(id('no-existe'))).toBeUndefined();
  });

  it('RN-TRN-17: series por el order del ítem y luego setNumber; exercises con todas las options', async () => {
    const workout = stored('w', 'in_progress', '2026-11-21', ['prensa', 'dominadas']);
    const sets = [
      doneSet('d2', 'w', 'dominadas', 2),
      doneSet('p2', 'w', 'prensa', 2),
      doneSet('d1', 'w', 'dominadas', 1),
      doneSet('p1', 'w', 'prensa', 1),
    ];
    const { service } = setup({ initial: [{ workout, sets }] });

    const view = await service.getWorkoutView(id('w'));

    expect(view?.workout).toEqual(workout);
    expect(view?.sets.map((s) => s.id)).toEqual(['p1', 'p2', 'd1', 'd2']);
    expect(Object.keys(view?.exercises ?? {}).sort()).toEqual(['dominadas', 'jalon', 'prensa']);
    expect(view?.exercises[id('jalon')]).toEqual(byId('jalon'));
  });

  it('RN-TRN-17: un workout inexistente → undefined', async () => {
    const { service } = setup();
    expect(await service.getWorkoutView(id('no-existe'))).toBeUndefined();
  });

  it('RN-TRN-17: si plan no devuelve una option → lanza', async () => {
    const workout = stored('w', 'in_progress', '2026-11-21', ['dominadas']);
    const { service } = setup({ initial: [{ workout, sets: [] }], missing: ['jalon'] });
    await expect(service.getWorkoutView(id('w'))).rejects.toThrow(/jalon/);
  });
});

describe('getActiveWorkoutView (spec 003)', () => {
  it('RN-TRN-01: sin sesión activa → undefined, aunque haya completadas o descartadas', async () => {
    const { service } = setup({
      initial: [
        { workout: stored('c', 'completed', '2026-11-20'), sets: [] },
        { workout: stored('d', 'discarded', '2026-11-19'), sets: [] },
      ],
    });
    expect(await service.getActiveWorkoutView()).toBeUndefined();
  });

  it('RN-TRN-17: la vista del activo es la misma que da getWorkoutView', async () => {
    const { service, workout } = await started();
    const view = await service.getActiveWorkoutView();
    expect(view?.workout.id).toBe(workout.id);
    expect(view).toEqual(await service.getWorkoutView(workout.id));
  });

  it('RN-TRN-17: armada como getWorkoutView, con las series ordenadas y todas las options', async () => {
    const workout = stored('w', 'in_progress', '2026-11-21', ['prensa', 'dominadas']);
    const sets = [doneSet('d1', 'w', 'dominadas', 1), doneSet('p1', 'w', 'prensa', 1)];
    const { service } = setup({ initial: [{ workout, sets }] });

    const view = await service.getActiveWorkoutView();

    expect(view?.sets.map((s) => s.id)).toEqual(['p1', 'd1']);
    expect(Object.keys(view?.exercises ?? {}).sort()).toEqual(['dominadas', 'jalon', 'prensa']);
  });

  it('RN-TRN-01: con varias in_progress (dato roto) → la vista de la de startedAt más reciente', async () => {
    const at = (key: string, startedAt: string): WorkoutState => ({
      workout: { ...stored(key, 'in_progress', '2026-11-20'), startedAt: instant(startedAt) },
      sets: [],
    });
    const { service } = setup({
      initial: [
        at('a', '2026-11-20T08:00:00-06:00'),
        at('b', '2026-11-20T18:00:00-06:00'),
        at('c', '2026-11-20T10:00:00-06:00'),
      ],
    });
    expect((await service.getActiveWorkoutView())?.workout.id).toBe('b');
  });
});

describe('datos inconsistentes (bugs, no errores esperados)', () => {
  it('un día de pesas sin semana del programa → startWorkout lanza', async () => {
    const { service, plan } = setup();
    plan.getTodayPlan.mockResolvedValueOnce({
      ...workoutDay,
      position: { ...position, week: null },
    });
    await expect(service.startWorkout(date('2026-11-16'))).rejects.toThrow(/RN-PLN-01/);
  });

  it('un ítem del plan sin su ítem de plantilla → startWorkout lanza', async () => {
    const { service, plan } = setup();
    plan.getTodayPlan.mockResolvedValueOnce({
      ...workoutDay,
      template: { ...template, items: template.items.slice(0, 2) },
    });
    await expect(service.startWorkout(date('2026-11-16'))).rejects.toThrow(/order 3/);
  });

  it('una serie cuyo workout no existe → training/workout-not-found', async () => {
    const { service, store } = setup();
    store.sets.set(id('huerfana'), doneSet('huerfana', 'no-existe', 'prensa', 1));
    expect(await service.logSet(id('huerfana'), { reps: 1 })).toMatchObject({
      ok: false,
      error: { code: 'training/workout-not-found' },
    });
  });

  it('RN-TRN-17: una serie de un ejercicio que no está en los ítems va al final', async () => {
    const workout = stored('w', 'in_progress', '2026-11-21', ['prensa']);
    const sets = [doneSet('x1', 'w', 'jalon', 1), doneSet('p1', 'w', 'prensa', 1)];
    const { service } = setup({ initial: [{ workout, sets }] });
    expect((await service.getWorkoutView(id('w')))?.sets.map((s) => s.id)).toEqual(['p1', 'x1']);
  });
});

describe('getExerciseHistory (RN-TRN-08)', () => {
  const history = () =>
    setup({
      initial: [
        {
          workout: stored('w09', 'completed', '2026-11-09', ['dead-bug', 'prensa']),
          sets: [
            doneSet('a2', 'w09', 'prensa', 2, { weightKg: 60, reps: 9 }),
            doneSet('a1', 'w09', 'prensa', 1, { weightKg: 60, reps: 10 }),
            doneSet('a3', 'w09', 'prensa', 3, { done: false }),
            doneSet('a0', 'w09', 'dead-bug', 1, { weightKg: null }),
          ],
        },
        {
          workout: stored('w13', 'completed', '2026-11-13'),
          sets: [doneSet('b1', 'w13', 'prensa', 1, { done: false })],
        },
        {
          workout: stored('w14', 'discarded', '2026-11-14'),
          sets: [doneSet('c1', 'w14', 'prensa', 1)],
        },
        // Inserted before the later one, so only sorting by startedAt puts it second.
        {
          workout: stored('w16-early', 'completed', '2026-11-16'),
          sets: [doneSet('e1', 'w16-early', 'prensa', 1, { weightKg: 62.5 })],
        },
        {
          workout: {
            ...stored('w16-late', 'completed', '2026-11-16'),
            startedAt: instant('2026-11-16T19:00:00-06:00'),
          },
          sets: [doneSet('d1', 'w16-late', 'prensa', 1, { weightKg: 65 })],
        },
        {
          workout: stored('w21', 'in_progress', '2026-11-21'),
          sets: [doneSet('f1', 'w21', 'prensa', 1)],
        },
      ],
    }).service;

  it('solo completed con series hechas, de la más reciente a la más antigua', async () => {
    const sessions = await history().getExerciseHistory(id('prensa'));
    expect(sessions.map((s) => s.workoutId)).toEqual(['w16-late', 'w16-early', 'w09']);
  });

  it('series hechas por setNumber, con el repRange del ítem del ejercicio', async () => {
    const [w09] = await history().getExerciseHistory(id('prensa'), { before: date('2026-11-16') });
    expect(w09).toEqual({
      workoutId: 'w09',
      date: '2026-11-09',
      repRange: [9, 12],
      sets: [
        doneSet('a1', 'w09', 'prensa', 1, { weightKg: 60, reps: 10 }),
        doneSet('a2', 'w09', 'prensa', 2, { weightKg: 60, reps: 9 }),
      ],
    });
  });

  it('before es exclusivo y limit recorta', async () => {
    const service = history();
    expect(
      (await service.getExerciseHistory(id('prensa'), { before: date('2026-11-16') })).map(
        (s) => s.workoutId,
      ),
    ).toEqual(['w09']);
    expect(
      (await service.getExerciseHistory(id('prensa'), { limit: 1 })).map((s) => s.workoutId),
    ).toEqual(['w16-late']);
  });

  it('sin sesiones del ejercicio → []', async () => {
    expect(await history().getExerciseHistory(id('jalon'))).toEqual([]);
  });
});

// Spec 005 (contract v1.22, decision 24): closing, the list of closed workouts and a day done.

describe('finishWorkout (RN-TRN-06, 22)', () => {
  // Friday's session started on Saturday, with Prensa 1 done.
  async function withDoneSet(options: Parameters<typeof setup>[0] = {}) {
    const ctx = await started(options);
    expectOk(await ctx.service.logSet(ctx.setOf('prensa'), { weightKg: 60, reps: 10 }));
    expectOk(await ctx.service.toggleSetDone(ctx.setOf('prensa')));
    return ctx;
  }

  it('RN-TRN-22: con dolor cierra y guarda completed, finishedAt del reloj y las notas (AC-18)', async () => {
    const { service, store, workout, hasPainEntry } = await withDoneSet();

    const closed = expectOk(await service.finishWorkout(workout.id, { notes: '  Buena sesión ' }));

    expect(closed).toMatchObject({
      id: workout.id,
      status: 'completed',
      finishedAt: saturday.now(),
      notes: 'Buena sesión',
    });
    expect(store.workouts.get(workout.id)).toEqual(closed);
    expect(hasPainEntry).toHaveBeenCalledWith(workout.id);
  });

  it('RN-TRN-22: finishedAt es la hora del cierre, no la del inicio', async () => {
    // Started Friday evening, closed with the clock at Saturday 09:30.
    const friday: WorkoutState = {
      workout: { ...stored('viernes', 'in_progress', '2026-11-20') },
      sets: [doneSet('s1', 'viernes', 'prensa', 1)],
    };
    const { service } = setup({ initial: [friday] });

    const closed = expectOk(await service.finishWorkout(id('viernes'), {}));

    expect(closed.startedAt).toBe('2026-11-20T09:00:00-06:00');
    expect(closed.finishedAt).toBe(saturday.now());
  });

  it('RN-TRN-22: las series no hechas siguen guardadas (AC-20)', async () => {
    const { service, store, workout } = await withDoneSet();

    expectOk(await service.finishWorkout(workout.id, {}));

    const own = [...store.sets.values()].filter((s) => s.workoutId === workout.id);
    expect(own).toHaveLength(4);
    expect(own.filter((s) => !s.done)).toHaveLength(3);
  });

  it('RN-TRN-06: sin dolor → pain-required y no cambia nada', async () => {
    const painGate = { hasPainEntry: vi.fn(() => Promise.resolve(false)) };
    const { service, store, workout } = await withDoneSet({ painGate });

    const result = await service.finishWorkout(workout.id, {});

    expect(result).toMatchObject({ ok: false, error: { code: 'training/pain-required' } });
    expect(store.workouts.get(workout.id)?.status).toBe('in_progress');
  });

  it('RN-TRN-22: un workout inexistente → workout-not-found, sin preguntar al PainGate', async () => {
    const { service, hasPainEntry } = setup();

    expect(await service.finishWorkout(id('nadie'), {})).toMatchObject({
      ok: false,
      error: { code: 'training/workout-not-found' },
    });
    expect(hasPainEntry).not.toHaveBeenCalled();
  });

  it('RN-TRN-22: sin series hechas → nothing-done, sin preguntar al PainGate', async () => {
    const { service, workout, hasPainEntry } = await started();

    expect(await service.finishWorkout(workout.id, {})).toMatchObject({
      ok: false,
      error: { code: 'training/nothing-done' },
    });
    expect(hasPainEntry).not.toHaveBeenCalled();
  });

  it('RN-TRN-07: un workout descartado → workout-closed, sin preguntar al PainGate', async () => {
    const { service, workout, hasPainEntry } = await withDoneSet();
    expectOk(await service.discardWorkout(workout.id));

    expect(await service.finishWorkout(workout.id, {})).toMatchObject({
      ok: false,
      error: { code: 'training/workout-closed' },
    });
    expect(hasPainEntry).not.toHaveBeenCalled();
  });

  it('RN-TRN-22: si otra pestaña cierra mientras se pregunta al PainGate → workout-closed (AC-31)', async () => {
    const ctx = await withDoneSet({
      painGate: {
        hasPainEntry: vi.fn((workoutId: ID) => {
          // The other tab closes it after this tab read the workout and before its transaction.
          const w = ctx.store.workouts.get(workoutId);
          if (w) ctx.store.workouts.set(workoutId, { ...w, status: 'completed' });
          return Promise.resolve(true);
        }),
      },
    });

    expect(await ctx.service.finishWorkout(ctx.workout.id, { notes: 'mía' })).toMatchObject({
      ok: false,
      error: { code: 'training/workout-closed' },
    });
    expect(ctx.store.workouts.get(ctx.workout.id)).not.toHaveProperty('notes');
  });

  it('RN-TRN-18: si el PainGate rechaza, finishWorkout rechaza y no cambia nada', async () => {
    const painGate = { hasPainEntry: vi.fn(() => Promise.reject(new Error('disk failure'))) };
    const { service, store, workout } = await withDoneSet({ painGate });

    await expect(service.finishWorkout(workout.id, {})).rejects.toThrow(/disk failure/);
    expect(store.workouts.get(workout.id)?.status).toBe('in_progress');
  });

  it('RN-TRN-22: notas de 2001 caracteres → notes-too-long y no cambia nada', async () => {
    const { service, store, workout } = await withDoneSet();

    expect(await service.finishWorkout(workout.id, { notes: 'a'.repeat(2001) })).toMatchObject({
      ok: false,
      error: { code: 'training/notes-too-long' },
    });
    expect(store.workouts.get(workout.id)?.status).toBe('in_progress');
  });
});

describe('listWorkouts (RN-TRN-26)', () => {
  const at = (key: string, status: Workout['status'], d: string, startedAt?: string) => ({
    workout: {
      ...stored(key, status, d),
      ...(startedAt ? { startedAt: instant(startedAt) } : {}),
    },
    sets: [],
  });

  it('RN-TRN-26: solo completed, con los límites incluidos, del más reciente al más antiguo', async () => {
    const { service } = setup({
      initial: [
        at('antes', 'completed', '2026-11-15'),
        at('lunes', 'completed', '2026-11-16'),
        at('miercoles', 'completed', '2026-11-18'),
        at('descartado', 'discarded', '2026-11-19'),
        at('domingo', 'completed', '2026-11-22'),
        at('despues', 'completed', '2026-11-23'),
      ],
    });

    const listed = await service.listWorkouts({ from: date('2026-11-16'), to: date('2026-11-22') });

    expect(listed.map((w) => w.id)).toEqual(['domingo', 'miercoles', 'lunes']);
  });

  it('RN-TRN-26: in_progress no sale', async () => {
    const { service } = setup({ initial: [at('curso', 'in_progress', '2026-11-18')] });

    expect(
      await service.listWorkouts({ from: date('2026-11-16'), to: date('2026-11-22') }),
    ).toEqual([]);
  });

  it('RN-TRN-26: el mismo día, por startedAt como instante y no como string', async () => {
    // 10:00+01:00 is 09:00Z, before 09:30Z, though it sorts after it as a string.
    const { service } = setup({
      initial: [
        at('madrid', 'completed', '2026-11-18', '2026-11-18T10:00:00+01:00'),
        at('londres', 'completed', '2026-11-18', '2026-11-18T09:30:00+00:00'),
      ],
    });

    const listed = await service.listWorkouts({ from: date('2026-11-18'), to: date('2026-11-18') });

    expect(listed.map((w) => w.id)).toEqual(['londres', 'madrid']);
  });

  it('RN-TRN-26: con from > to → []', async () => {
    const { service } = setup({ initial: [at('lunes', 'completed', '2026-11-16')] });

    expect(
      await service.listWorkouts({ from: date('2026-11-22'), to: date('2026-11-16') }),
    ).toEqual([]);
  });
});

describe('listWorkoutHistory (RN-TRN-28)', () => {
  // A closed workout of `d`, started at 09:00-06:00 and finished `minutes` later.
  const closed = (
    key: string,
    d: string,
    exerciseIds: string[],
    sets: SetLog[],
    overrides: Partial<Workout> = {},
  ): WorkoutState => ({
    workout: {
      ...stored(key, 'completed', d, exerciseIds),
      finishedAt: instant(`${d}T09:52:00-06:00`),
      ...overrides,
    },
    sets,
  });

  it('RN-TRN-28: solo completed, en el orden de RN-TRN-26 (date y luego startedAt como instante)', async () => {
    const { service } = setup({
      initial: [
        closed('lunes', '2026-11-16', ['prensa'], []),
        { workout: stored('curso', 'in_progress', '2026-11-19'), sets: [] },
        { workout: stored('descartado', 'discarded', '2026-11-20'), sets: [] },
        // 10:00+01:00 is 09:00Z, before 09:30Z, though it sorts after it as a string.
        closed('madrid', '2026-11-23', ['prensa'], [], {
          startedAt: instant('2026-11-23T10:00:00+01:00'),
        }),
        closed('miercoles', '2026-11-18', ['prensa'], []),
        closed('londres', '2026-11-23', ['prensa'], [], {
          startedAt: instant('2026-11-23T09:30:00+00:00'),
        }),
      ],
    });

    const history = await service.listWorkoutHistory();

    expect(history.map((e) => e.workout.id)).toEqual(['londres', 'madrid', 'miercoles', 'lunes']);
  });

  it('RN-TRN-28: cada entrada con el resumen de RN-TRN-25 de sus propias series', async () => {
    const { service } = setup({
      initial: [
        closed(
          'completa',
          '2026-11-16',
          ['prensa', 'jalon'],
          [
            doneSet('c1', 'completa', 'prensa', 1),
            doneSet('c2', 'completa', 'prensa', 2),
            doneSet('c3', 'completa', 'jalon', 1),
            doneSet('c4', 'completa', 'jalon', 2, { isExtra: true }),
          ],
        ),
        closed(
          'parcial',
          '2026-11-18',
          ['prensa', 'jalon', 'dead-bug'],
          [
            doneSet('p1', 'parcial', 'prensa', 1),
            doneSet('p2', 'parcial', 'jalon', 1, { done: false }),
          ],
        ),
      ],
    });

    const history = await service.listWorkoutHistory();

    expect(history.map((e) => [e.workout.id, e.summary])).toEqual([
      ['parcial', { minutes: 52, setsDone: 1, itemsWithDoneSets: 1, itemCount: 3 }],
      ['completa', { minutes: 52, setsDone: 4, itemsWithDoneSets: 2, itemCount: 2 }],
    ]);
  });

  it('RN-TRN-28: sin finishedAt (dato roto) el resumen da 0 min, no los minutos hasta ahora', async () => {
    const broken = closed('roto', '2026-11-16', ['prensa'], [doneSet('r1', 'roto', 'prensa', 1)]);
    delete broken.workout.finishedAt;
    const { service } = setup({ initial: [broken] });

    const [entry] = await service.listWorkoutHistory();

    expect(entry?.summary).toMatchObject({ minutes: 0, setsDone: 1 });
  });

  it('RN-TRN-28: sin sesiones cerradas → []', async () => {
    const { service } = setup({
      initial: [{ workout: stored('curso', 'in_progress', '2026-11-19'), sets: [] }],
    });

    expect(await service.listWorkoutHistory()).toEqual([]);
  });
});

describe('startWorkout de un día ya hecho (RN-TRN-24)', () => {
  const friday = (status: Workout['status']): WorkoutState => ({
    workout: { ...stored(`viernes-${status}`, status, '2026-11-20') },
    sets: [],
  });

  it('RN-TRN-24: un día con un completed → already-done, sin details y sin crear nada (AC-35)', async () => {
    const { service, store } = setup({ initial: [friday('completed')] });

    const result = await service.startWorkout(date('2026-11-21'), {
      plannedFor: date('2026-11-20'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('training/already-done');
    expect(result.error.message).toMatch(/RN-TRN-24/);
    expect(result.error).not.toHaveProperty('details');
    expect(store.workouts.size).toBe(1);
  });

  it('RN-TRN-24: con uno activo gana workout-already-active', async () => {
    const active: WorkoutState = {
      workout: stored('activo', 'in_progress', '2026-11-16'),
      sets: [],
    };
    const { service } = setup({ initial: [friday('completed'), active] });

    expect(
      await service.startWorkout(date('2026-11-21'), { plannedFor: date('2026-11-20') }),
    ).toMatchObject({ ok: false, error: { code: 'training/workout-already-active' } });
  });

  it('RN-TRN-23: un discarded de ese día no lo cuenta como hecho', async () => {
    const { service } = setup({ initial: [friday('discarded')] });

    expect(
      (await service.startWorkout(date('2026-11-21'), { plannedFor: date('2026-11-20') })).ok,
    ).toBe(true);
  });

  it('RN-TRN-24: un completed de otro día no bloquea este', async () => {
    const monday: WorkoutState = { workout: stored('lunes', 'completed', '2026-11-16'), sets: [] };
    const { service } = setup({ initial: [monday] });

    expect(
      (await service.startWorkout(date('2026-11-21'), { plannedFor: date('2026-11-20') })).ok,
    ).toBe(true);
  });

  it('RN-TRN-24: tras cerrar una sesión, iniciar el mismo día del plan → already-done', async () => {
    const { service, workout, setOf } = await started();
    expectOk(await service.logSet(setOf('prensa'), { weightKg: 60, reps: 10 }));
    expectOk(await service.toggleSetDone(setOf('prensa')));
    expectOk(await service.finishWorkout(workout.id, {}));

    expect(
      await service.startWorkout(date('2026-11-21'), { plannedFor: date('2026-11-20') }),
    ).toMatchObject({ ok: false, error: { code: 'training/already-done' } });
  });
});

// Spec 005b, AC-1 to AC-6. The fake plan only has workouts on Monday 16 and Friday 20, so the
// examples start on Saturday 21 with plannedFor Friday 20.
describe('startWorkout en un día ya entrenado (RN-TRN-27)', () => {
  const saved = (
    key: string,
    d: string,
    plannedFor: string,
    status: Workout['status'] = 'completed',
    extra: Partial<Workout> = {},
  ): WorkoutState => ({
    workout: { ...stored(key, status, d), plannedFor: date(plannedFor), ...extra },
    sets: [],
  });
  const startFriday = (service: ReturnType<typeof setup>['service']) =>
    service.startWorkout(date('2026-11-21'), { plannedFor: date('2026-11-20') });

  it('RN-TRN-27: con un completed del sábado, otro día del plan ese sábado → day-already-trained, sin details y sin crear nada (AC-1)', async () => {
    const { service, store } = setup({
      initial: [saved('lunes-el-sabado', '2026-11-21', '2026-11-16')],
    });

    const result = await startFriday(service);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('training/day-already-trained');
    expect(result.error.message).toMatch(/RN-TRN-27/);
    expect(result.error).not.toHaveProperty('details');
    expect(store.workouts.size).toBe(1);
  });

  it('RN-TRN-27: si el día del plan también está hecho, gana already-done (AC-2)', async () => {
    const { service } = setup({
      initial: [saved('viernes-el-sabado', '2026-11-21', '2026-11-20')],
    });

    expect(await startFriday(service)).toMatchObject({
      ok: false,
      error: { code: 'training/already-done' },
    });
  });

  it('RN-TRN-27: con uno activo gana workout-already-active (AC-3)', async () => {
    const { service } = setup({
      initial: [
        saved('lunes-el-sabado', '2026-11-21', '2026-11-16'),
        saved('activo', '2026-11-16', '2026-11-16', 'in_progress'),
      ],
    });

    expect(await startFriday(service)).toMatchObject({
      ok: false,
      error: { code: 'training/workout-already-active' },
    });
  });

  it('RN-TRN-27: un discarded del mismo día no lo impide (AC-4)', async () => {
    const { service } = setup({
      initial: [saved('descartado', '2026-11-21', '2026-11-16', 'discarded')],
    });

    expect((await startFriday(service)).ok).toBe(true);
  });

  it('RN-TRN-27: solo cuenta el date: un completed de otro día cuyo plannedFor es este día no lo impide (AC-5)', async () => {
    const { service } = setup({ initial: [saved('otro-dia', '2026-11-20', '2026-11-21')] });

    expect((await startFriday(service)).ok).toBe(true);
  });

  it('RN-TRN-27: cuenta el día de inicio, no el de finishedAt: una sesión de la noche anterior cerrada tras medianoche no lo impide (AC-6)', async () => {
    const { service } = setup({
      initial: [
        saved('noche', '2026-11-20', '2026-11-16', 'completed', {
          startedAt: instant('2026-11-20T23:50:00-06:00'),
          finishedAt: instant('2026-11-21T00:40:00-06:00'),
        }),
      ],
    });

    expect((await startFriday(service)).ok).toBe(true);
  });

  it('RN-TRN-27: tras cerrar una sesión, otra de la semana el mismo día → day-already-trained (T23 de la spec 005)', async () => {
    const { service, store, workout, setOf } = await started();
    expectOk(await service.logSet(setOf('prensa'), { weightKg: 60, reps: 10 }));
    expectOk(await service.toggleSetDone(setOf('prensa')));
    expectOk(await service.finishWorkout(workout.id, {}));

    expect(
      await service.startWorkout(date('2026-11-21'), { plannedFor: date('2026-11-16') }),
    ).toMatchObject({ ok: false, error: { code: 'training/day-already-trained' } });
    expect(store.workouts.size).toBe(1);
  });
});
