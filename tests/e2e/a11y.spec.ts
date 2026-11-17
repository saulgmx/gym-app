import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { freezeClockAt, USER_TIME_ZONE } from './helpers';
import { PAGES } from './pages';

// Spec 000 AC-26 and spec 001 AC-22: no WCAG 2.2 A/AA violations.

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

for (const { path, heading } of PAGES) {
  test(`AC-26: ${path} has no WCAG 2.2 A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

// "Hoy" with the plan loaded, on a workout day and a rest day (spec 001 AC-22). The heading of
// the day is awaited, so axe checks the real content and not the loading state.
test.describe('AC-22: Hoy with the plan loaded', () => {
  test.use({ timezoneId: USER_TIME_ZONE });

  for (const { day, at, heading } of [
    { day: 'workout day', at: '2026-11-18T08:00:00-06:00', heading: 'Full body B' },
    { day: 'rest day', at: '2026-11-19T08:00:00-06:00', heading: 'Descanso' },
  ]) {
    test(`${day} has no WCAG 2.2 A/AA violations`, async ({ page }) => {
      await freezeClockAt(page, at);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
