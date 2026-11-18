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
