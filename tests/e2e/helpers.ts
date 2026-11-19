import { expect, type Page } from '@playwright/test';

// Helpers shared by the e2e specs.

/** Waits until a service worker controls the page. The first visit only installs it. */
export async function waitForControllingWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (await page.evaluate(() => navigator.serviceWorker.controller === null)) {
    await page.reload();
  }
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

/** Device time zone of the user (ADR-0009), so dates in e2e do not depend on the machine. */
export const USER_TIME_ZONE = 'America/Mexico_City';

/** Freezes the page's clock before the first navigation; timers keep running. */
export async function freezeClockAt(page: Page, isoWithOffset: string) {
  await page.clock.setFixedTime(new Date(isoWithOffset));
}

/**
 * Opens "Hoy" on any date of the program, or outside it. A fresh database starts the program on
 * the Monday of the first visit's week (RN-PLN-13), so the first visit is on Monday 2026-11-16 and
 * then the clock moves to `isoWithOffset` and the page reloads.
 */
export async function openTodayOn(page: Page, isoWithOffset: string) {
  await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
  await page.goto('/');
  await expect(page.getByText('Lunes 16 nov', { exact: true })).toBeVisible();
  await freezeClockAt(page, isoWithOffset);
  await page.reload();
}

/**
 * Fakes the page's timers from `isoWithOffset` (spec 003 AC-17). Unlike freezeClockAt, time keeps
 * flowing until the test calls `page.clock.pauseAt`, and then only `runFor` moves it. Only the
 * tests that need to see the elapsed time change use it; the others keep real timers.
 */
export async function installClockAt(page: Page, isoWithOffset: string) {
  await page.clock.install({ time: new Date(isoWithOffset) });
}

/**
 * Interactive elements smaller than 44 × 44 px (spec 002 AC-39). A checkbox or switch is tapped
 * through its <label>, so the label is what gets measured.
 */
export async function smallTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const MIN = 44;
    const controls = document.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea',
    );
    const small: string[] = [];
    for (const control of controls) {
      if (control.getClientRects().length === 0) continue; // not rendered (closed dialog)
      const isToggle = control instanceof HTMLInputElement && control.type === 'checkbox';
      const target = (isToggle ? control.closest('label') : null) ?? control;
      const { width, height } = target.getBoundingClientRect();
      if (width < MIN || height < MIN) {
        const name = control.getAttribute('aria-label') ?? control.textContent.trim();
        small.push(
          `${control.tagName.toLowerCase()} "${name}": ${String(Math.round(width))} × ${String(Math.round(height))}`,
        );
      }
    }
    return small;
  });
}

/** Values of every stored set, read straight from IndexedDB (the app's `gym-app` database). */
async function storedSets(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ weightKg: number | null; reps: number | null }[]>((resolve, reject) => {
        const open = indexedDB.open('gym-app');
        open.onerror = () => {
          reject(new Error('Cannot open gym-app'));
        };
        open.onsuccess = () => {
          const request = open.result.transaction('sets').objectStore('sets').getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result as { weightKg: number | null; reps: number | null }[]);
          };
        };
      }),
  );
}

/** `startedAt` of the only workout, read straight from IndexedDB (an Instant, in seconds). */
export async function storedStartedAt(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('gym-app');
        open.onerror = () => {
          reject(new Error('Cannot open gym-app'));
        };
        open.onsuccess = () => {
          const request = open.result.transaction('workouts').objectStore('workouts').getAll();
          request.onsuccess = () => {
            open.result.close();
            const [workout] = request.result as { startedAt: string }[];
            if (!workout) reject(new Error('No workout stored'));
            else resolve(workout.startedAt);
          };
        };
      }),
  );
}

/** Every row of a table of the app's `gym-app` database, read straight from IndexedDB. */
export async function storedRows<Row>(page: Page, table: string): Promise<Row[]> {
  return page.evaluate(
    (name) =>
      new Promise<Row[]>((resolve, reject) => {
        const open = indexedDB.open('gym-app');
        open.onerror = () => {
          reject(new Error('Cannot open gym-app'));
        };
        open.onsuccess = () => {
          const request = open.result.transaction(name).objectStore(name).getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result as Row[]);
          };
        };
      }),
    table,
  );
}

/**
 * Waits until a confirmed value is written (RN-TRN-03). A field is saved a few milliseconds after
 * Enter; a reload in between would abort the write, which no user can do that fast.
 */
export async function waitForStoredSet(
  page: Page,
  matches: (set: { weightKg: number | null; reps: number | null }) => boolean,
) {
  await expect.poll(async () => (await storedSets(page)).some(matches)).toBe(true);
}

// Spec 005: the session and the Cierre, shared by close.spec and a11y.spec.

const SESSION_URL = /\/sesion\/([^/]+)\/(\d+)$/;

/** Types a value and confirms it with Enter, as on the phone keyboard. */
async function type(page: Page, name: string, value: string) {
  const field = page.getByRole('textbox', { name });
  await field.fill(value);
  await field.press('Enter');
}

/** Logs set `n` of the exercise on screen and marks it done (RN-TRN-04: values first). */
export async function doSet(page: Page, n: number, withKilos: boolean) {
  const set = `Serie ${String(n)}`;
  if (withKilos) await type(page, `${set}, kilos`, '40');
  await type(page, `${set}, repeticiones`, '10');
  await type(page, `${set}, RIR`, '3');
  const check = page.getByRole('checkbox', { name: `${set} hecha` });
  await check.click();
  await expect(check).toBeChecked();
}

/** Starts Full body A from "Hoy" (already open) and returns the workout ID. */
export async function startSession(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Empezar sesión' }).click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(page.getByText('Ejercicio 1 de 7')).toBeVisible();
  const id = SESSION_URL.exec(page.url())?.[1];
  if (!id) throw new Error('No workout ID in the URL');
  return id;
}

/** From "Hoy" (already open): starts, does the first set and opens the Cierre from the sheet. */
export async function cierreWithOneSet(page: Page): Promise<string> {
  const id = await startSession(page);
  await doSet(page, 1, true);
  await page.getByRole('button', { name: 'Salir de la sesión' }).click();
  await page
    .getByRole('dialog', { name: '¿Salir de la sesión?' })
    .getByRole('link', { name: 'Terminar y guardar lo hecho' })
    .click();
  await expect(page).toHaveURL(`/sesion/${id}/cierre`);
  await expect(page.getByRole('heading', { level: 1, name: 'Sesión terminada' })).toBeVisible();
  return id;
}

export const painLevel = (page: Page, n: number) =>
  page
    .getByRole('group', { name: 'Dolor lumbar' })
    .getByRole('button', { name: String(n), exact: true });
