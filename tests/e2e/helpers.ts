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
