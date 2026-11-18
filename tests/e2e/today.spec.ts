import { expect, test, type Page } from '@playwright/test';
import { freezeClockAt, USER_TIME_ZONE, waitForControllingWorker } from './helpers';

// Spec 001 AC-1 and AC-7 on the production build. Each test starts with an empty IndexedDB, so
// the seed loads on the first visit with startDate = Monday 2026-11-16 (RN-PLN-13).

test.use({ timezoneId: USER_TIME_ZONE });

async function expectWednesdayOfWeekOne(page: Page) {
  await expect(page.getByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
  await expect(page.getByText('Miércoles 18 de noviembre')).toBeVisible();
  await expect(page.getByText('Bloque 1 · Full body')).toBeVisible();
  await expect(page.getByText('Semana 1 de 15')).toBeVisible();
  const strip = page.getByRole('list', { name: 'Semana' });
  await expect(
    strip.getByRole('img', { name: 'miércoles, hoy, Full body B, pendiente' }),
  ).toBeVisible();
}

test('AC-1: first start on Wednesday 2026-11-18 shows Full body B of week 1', async ({ page }) => {
  await freezeClockAt(page, '2026-11-18T08:00:00-06:00');
  await page.goto('/');

  await expectWednesdayOfWeekOne(page);
});

test('ADR-0009: late on Wednesday in Mexico (already Thursday in UTC) is still Wednesday', async ({
  page,
}) => {
  await freezeClockAt(page, '2026-11-18T23:30:00-06:00');
  await page.goto('/');

  await expectWednesdayOfWeekOne(page);
});

test('AC-7: after a first visit, reloading offline still shows the session', async ({
  page,
  context,
}) => {
  await freezeClockAt(page, '2026-11-18T08:00:00-06:00');
  await page.goto('/');
  await expectWednesdayOfWeekOne(page);
  await waitForControllingWorker(page);

  await context.setOffline(true);
  await page.reload();

  await expectWednesdayOfWeekOne(page);
});
