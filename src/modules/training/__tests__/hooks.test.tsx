import 'fake-indexeddb/auto';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { Dexie } from 'dexie';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixedClock, sequentialIds, type ID, type Instant, type LocalDate } from '@/shared/kernel';
import {
  createTraining,
  trainingStores,
  useActiveWorkout,
  useLastSession,
  useWorkoutView,
  type TrainingApi,
  type Workout,
} from '..';
import type { PlanReader } from '../application/ports';
import { plan, prensa } from './fixtures/plan';

// Reactive hooks over the real training module and IndexedDB in memory (RN-TRN-19, plan §6.4).

const date = (s: string) => s as LocalDate;
const SATURDAY = date('2026-11-21');

let db: Dexie;
let training: TrainingApi;

function open(planReader: PlanReader = plan) {
  db = new Dexie(crypto.randomUUID());
  db.version(1).stores(trainingStores);
  training = createTraining({
    db,
    clock: fixedClock('2026-11-21T09:30:00-06:00'),
    ids: sequentialIds(),
    plan: planReader,
    suggestions: { getPrefill: () => Promise.resolve(null) },
  });
}

beforeEach(() => {
  open();
});

afterEach(async () => {
  vi.restoreAllMocks();
  db.close();
  await Dexie.delete(db.name);
});

async function start(): Promise<Workout> {
  const result = await training.startWorkout(SATURDAY);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

async function firstPrensaSet() {
  const view = await training.getWorkoutView((await training.getActiveWorkout())?.id ?? ('' as ID));
  const set = view?.sets.find((s) => s.exerciseId === prensa.id);
  if (!set) throw new Error('No Prensa set');
  return set.id;
}

describe('useActiveWorkout', () => {
  it('RN-TRN-19: undefined mientras carga, null sin sesión y se actualiza solo', async () => {
    const { result } = renderHook(() => useActiveWorkout(training));
    expect(result.current).toBeUndefined();
    await waitFor(() => {
      expect(result.current).toBeNull();
    });

    const workout = await start();
    await waitFor(() => {
      expect(result.current?.id).toBe(workout.id);
    });

    await training.discardWorkout(workout.id);
    await waitFor(() => {
      expect(result.current).toBeNull();
    });
  });
});

describe('useWorkoutView', () => {
  it('RN-TRN-19: null si no existe; la vista y sus cambios al escribir en sets', async () => {
    const workout = await start();
    const { result } = renderHook(() => useWorkoutView(training, workout.id));
    await waitFor(() => {
      expect(result.current?.sets).toHaveLength(3);
    });

    await training.logSet(await firstPrensaSet(), { weightKg: 60 });

    await waitFor(() => {
      expect(result.current?.sets[0]?.weightKg).toBe(60);
    });
    const missing = renderHook(() => useWorkoutView(training, 'no-existe' as ID));
    await waitFor(() => {
      expect(missing.result.current).toBeNull();
    });
  });

  it('RN-TRN-19: al cambiar de id nunca devuelve la vista del anterior', async () => {
    const first = await start();
    await training.discardWorkout(first.id);
    const second = await start();
    const seen: [ID, ID | undefined][] = [];
    const { result, rerender } = renderHook(
      ({ id }: { id: ID }) => {
        const view = useWorkoutView(training, id);
        seen.push([id, view ? view.workout.id : undefined]);
        return view;
      },
      { initialProps: { id: first.id } },
    );
    await waitFor(() => {
      expect(result.current?.workout.id).toBe(first.id);
    });

    rerender({ id: second.id });

    await waitFor(() => {
      expect(result.current?.workout.id).toBe(second.id);
    });
    expect(seen.filter(([id]) => id === second.id).map(([, got]) => got)).not.toContain(first.id);
  });
});

describe('useLastSession', () => {
  it('RN-TRN-19: null sin sesiones; la última completada anterior a before, y se actualiza', async () => {
    const workout = await start();
    const setId = await firstPrensaSet();
    await training.logSet(setId, { weightKg: 60, reps: 10 });
    await training.toggleSetDone(setId);
    const { result } = renderHook(() => useLastSession(training, prensa.id, date('2026-11-28')));
    await waitFor(() => {
      expect(result.current).toBeNull();
    });

    // Phase 2 cannot close a session; the test closes it in storage.
    await db.table<Workout>('workouts').update(workout.id, {
      status: 'completed',
      finishedAt: '2026-11-21T10:30:00-06:00' as Instant,
    });

    await waitFor(() => {
      expect(result.current?.sets.map((s) => [s.weightKg, s.reps])).toEqual([[60, 10]]);
    });
  });

  it('RN-TRN-19: before excluye el mismo día', async () => {
    const workout = await start();
    await db.table('sets').update(await firstPrensaSet(), { done: true, weightKg: 60, reps: 10 });
    await db.table<Workout>('workouts').update(workout.id, { status: 'completed' });

    const sameDay = renderHook(() => useLastSession(training, prensa.id, SATURDAY));
    const nextDay = renderHook(() => useLastSession(training, prensa.id, date('2026-11-22')));

    await waitFor(() => {
      expect(nextDay.result.current?.workoutId).toBe(workout.id);
    });
    expect(sameDay.result.current).toBeNull();
  });
});

class TestBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    return this.state.error ? <p role="alert">{this.state.error.message}</p> : this.props.children;
  }
}

function Session({ id }: { id: ID }) {
  const view = useWorkoutView(training, id);
  return <p>{view ? view.workout.id : 'cargando'}</p>;
}

describe('errores', () => {
  it('RN-TRN-19: un error de la consulta se lanza en el render y lo captura el boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs caught errors
    db.close();
    await Dexie.delete(db.name);
    open({ ...plan, getExercises: () => Promise.resolve([]) }); // options missing (RN-TRN-17)
    const workout = await start();

    render(
      <TestBoundary>
        <Session id={workout.id} />
      </TestBoundary>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/RN-TRN-17/);
  });
});
