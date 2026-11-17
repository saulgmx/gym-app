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
