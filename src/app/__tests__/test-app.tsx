import 'fake-indexeddb/auto';
import { act, render } from '@testing-library/react';
import type { userEvent } from '@testing-library/user-event';
import { Dexie } from 'dexie';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { fixedClock, type Clock } from '@/shared/kernel';
import { compose } from '../compose';
import { AppContext, type AppServices } from '../context';
import { openDatabase } from '../db';
import { routes } from '../router';
import planSeed from '../seed/plan-seed.json';

// Test services with the real plan module and seed over IndexedDB in memory (spec 001 plan
// §6.11). The seed is loaded with `seedClock` (start date: Monday of that week); pages read
// `clock`, so a test can look at a day before the program starts.

export const SEEDED_ON = fixedClock('2026-11-18T08:00:00-06:00'); // start date 2026-11-16

const opened: Dexie[] = [];

export function createTestServices({
  clock = SEEDED_ON,
  seedClock = SEEDED_ON,
  seed = planSeed,
}: { clock?: Clock; seedClock?: Clock; seed?: unknown } = {}): AppServices {
  const db = openDatabase({ name: crypto.randomUUID() });
  opened.push(db);
  const app = compose({ db, clock: seedClock, seed });
  return {
    plan: app.plan,
    training: app.training,
    health: app.health,
    data: app.data,
    clock,
    ready: app.ready,
  };
}

/** The database of the last createTestServices call, to write broken data the API forbids
 *  (spec 005b AC-17: two completed workouts on the same date, from before RN-TRN-27). */
export function lastTestDatabase(): Dexie {
  const db = opened.at(-1);
  if (!db) throw new Error('createTestServices was not called');
  return db;
}

/** Call from afterEach in files that use createTestServices. */
export async function closeTestDatabases() {
  const dbs = opened.splice(0);
  for (const db of dbs) db.close();
  await Promise.all(dbs.map((db) => Dexie.delete(db.name)));
}

/** A path, or a path with navigation state (spec 005: the Cierre reads `state.from`). */
export type Entry = string | { pathname: string; state: unknown };

function renderTree(path: Entry, services: AppServices) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppContext value={services}>
      <RouterProvider router={router} />
    </AppContext>,
  );
  return router;
}

/**
 * Renders a route once `ready` has settled, inside an awaited act(): in the test environment React
 * only retries a component suspended on use(ready) within an awaited act, and a plain render()
 * leaves the page on its Suspense fallback forever.
 */
export async function renderRoute(path: Entry, services: AppServices = createTestServices()) {
  await services.ready.catch(() => undefined);
  let router!: ReturnType<typeof renderTree>;
  await act(async () => {
    router = renderTree(path, services);
    await Promise.resolve();
  });
  return router;
}

/** Synchronous render, for a page whose `ready` never settles (loading state). */
export function renderRouteWhileLoading(path: Entry, services: AppServices) {
  return renderTree(path, services);
}

/**
 * A tap that navigates. React Router runs navigations as async transitions; inside the sync act()
 * of a plain click the pending work can be dropped, so the click is awaited inside act().
 */
export async function tapToNavigate(
  user: ReturnType<typeof userEvent.setup>,
  element: HTMLElement,
) {
  await act(() => user.click(element));
}
