import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixedClock } from '@/shared/kernel';
import { compose } from '../compose';
import { openDatabase } from '../db';
import planSeed from '../seed/plan-seed.json';

// Spec 001 plan §5 (startup): `ready` resolves with a valid seed and rejects with an invalid one
// or when the database does not open (AC-21, shown by use(ready) in T17).

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
  it("abre 'gym-app' en la versión 1 con las 4 tablas de plan", async () => {
    const db = openDatabase();
    opened.push(db);
    await db.open();

    expect(db.name).toBe('gym-app');
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'blocks',
      'exercises',
      'programs',
      'templates',
    ]);
  });
});
