import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as kernel from '@/shared/kernel';
import { fixedClock } from '@/shared/kernel';
import { compose } from '../compose';
import { openDatabase } from '../db';
import planSeed from '../seed/plan-seed.json';

// Spec 001 plan §5 (startup): `ready` resolves with a valid seed and rejects with an invalid one
// or when the database does not open (AC-21, shown by use(ready) in T17).

// The real kernel, with the UUIDv7 factory counted (spec 005 T7: one generator per device).
vi.mock('@/shared/kernel', async (importOriginal) => {
  const actual = await importOriginal<typeof kernel>();
  return { ...actual, createUuidV7Generator: vi.fn(actual.createUuidV7Generator) };
});

const clock = fixedClock('2026-11-18T08:00:00-06:00');
const opened: Dexie[] = [];

function start(seed: unknown, db: Dexie = openDatabase({ name: crypto.randomUUID() })) {
  opened.push(db);
  return compose({ db, clock, seed });
}

afterEach(async () => {
  vi.restoreAllMocks();
  const dbs = opened.splice(0);
  for (const db of dbs) db.close();
  await Promise.all(dbs.map((db) => Dexie.delete(db.name)));
});

// A factory whose open() always fails, as in a browser that blocks IndexedDB.
const brokenIndexedDB = {
  open: () => {
    throw new DOMException('IndexedDB blocked', 'InvalidStateError');
  },
} as unknown as IDBFactory;

describe('compose', () => {
  it('ADR-0009: training y health comparten un solo IdGenerator (monótono por dispositivo)', () => {
    vi.mocked(kernel.createUuidV7Generator).mockClear();

    start(planSeed);

    expect(kernel.createUuidV7Generator).toHaveBeenCalledTimes(1);
  });

  it('AC-46: health guarda el dolor en la base de la app', async () => {
    const app = start(planSeed);
    await app.ready;
    const started = await app.training.startWorkout(clock.today());
    if (!started.ok) throw new Error(started.error.code);

    const recorded = await app.health.recordPain(started.value.id, {
      level: 3,
      redFlags: [],
      date: started.value.date,
    });

    expect(recorded.ok).toBe(true);
    expect(await app.health.hasPainEntry(started.value.id)).toBe(true);
  });

  it('RN-TRN-06: training cierra con el painGate de health (spec 005 T12)', async () => {
    const app = start(planSeed);
    await app.ready;
    const started = await app.training.startWorkout(clock.today());
    if (!started.ok) throw new Error(started.error.code);
    const workout = started.value;
    const view = await app.training.getWorkoutView(workout.id);
    const first = view?.sets.find((s) => s.exerciseId === workout.items[0]?.exerciseId);
    if (!first) throw new Error('no first set');
    expect((await app.training.logSet(first.id, { weightKg: 60, reps: 10 })).ok).toBe(true);
    expect((await app.training.toggleSetDone(first.id)).ok).toBe(true);

    expect(await app.training.finishWorkout(workout.id, {})).toMatchObject({
      ok: false,
      error: { code: 'training/pain-required' },
    });
    expect(
      (await app.health.recordPain(workout.id, { level: 2, redFlags: [], date: workout.date })).ok,
    ).toBe(true);
    expect(await app.training.finishWorkout(workout.id, {})).toMatchObject({
      ok: true,
      value: { status: 'completed' },
    });
  });

  it('ready resuelve con el seed real y el plan queda cargado', async () => {
    const app = start(planSeed);

    await expect(app.ready).resolves.toBeUndefined();
    expect(await app.plan.getPosition(clock.today())).toMatchObject({ status: 'active', week: 1 });
  });

  it('ready rechaza con un seed inválido; el DomainError va en cause', async () => {
    const app = start({});

    const error: unknown = await app.ready.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).cause).toMatchObject({ code: 'plan/invalid-seed' });
  });

  it('ready rechaza con un ejercicio high (P-1)', async () => {
    const seed = structuredClone(planSeed);
    const [first] = seed.exercises;
    if (!first) throw new Error('The real seed has exercises');
    first.lumbarRisk = 'high';

    const error: unknown = await start(seed).ready.catch((e: unknown) => e);
    expect((error as Error).cause).toMatchObject({ code: 'plan/high-risk-exercise' });
  });

  it('ready rechaza si la base no abre', async () => {
    const db = openDatabase({ name: crypto.randomUUID(), indexedDB: brokenIndexedDB });

    await expect(start(planSeed, db).ready).rejects.toThrow();
  });

  it('el rechazo de ready queda manejado: no llega al manejador global', async () => {
    // jsdom never fires unhandledrejection, so the test checks that compose attaches a rejection
    // handler to `ready` itself: .catch(fn) calls then() with a function second. A vi.spyOn on
    // Promise.prototype.then recurses (Vitest uses promises), so then() is wrapped only while
    // compose runs.
    const calls: { promise: unknown; onRejected: unknown }[] = [];
    // eslint-disable-next-line @typescript-eslint/unbound-method -- only restored or invoked with .call(this)
    const originalThen = Promise.prototype.then;
    let app: ReturnType<typeof compose>;
    try {
      Promise.prototype.then = function (this: Promise<unknown>, onFulfilled, onRejected) {
        calls.push({ promise: this, onRejected });
        return originalThen.call(this, onFulfilled, onRejected);
      } as typeof originalThen;
      app = start({});
    } finally {
      Promise.prototype.then = originalThen;
    }

    expect(calls.some((c) => c.promise === app.ready && typeof c.onRejected === 'function')).toBe(
      true,
    );
    await app.ready.catch(() => undefined);
  });
});

describe('openDatabase', () => {
  it("abre 'gym-app' en la versión 3 con las tablas de plan, training y health", async () => {
    const db = openDatabase();
    opened.push(db);
    await db.open();

    expect(db.name).toBe('gym-app');
    expect(db.verno).toBe(3);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'blocks',
      'exercises',
      'painEntries',
      'programs',
      'sets',
      'templates',
      'workouts',
    ]);
  });
});
