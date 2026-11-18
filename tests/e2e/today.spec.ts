import { expect, test, type Page } from '@playwright/test';
import { freezeClockAt, USER_TIME_ZONE, waitForControllingWorker } from './helpers';

// Spec 001 AC-1 and AC-7 on the production build. Each test starts with an empty IndexedDB, so
// the seed loads on the first visit with startDate = Monday 2026-11-16 (RN-PLN-13).

test.use({ timezoneId: USER_TIME_ZONE });

async function expectWednesdayOfWeekOne(page: Page) {
  await expect(page.getByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
  // Exact, so "Miércoles 18 nov." (the period WebKit adds to the short month) does not match.
  await expect(page.getByText('Miércoles 18 nov', { exact: true })).toBeVisible();
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

// Spec 003 AC-1 (top row without a period in the month), AC-3, AC-7, AC-9, AC-2 and AC-29 on the
// production build. WebKit is the browser where Intl writes "nov."; formatShortDateTitle removes
// it, and unit tests under Node cannot see that (plan 003 §8).

test.describe('spec 003: Hoy en el estado D', () => {
  test('AC-1: lunes 16 nov, sin punto en el mes, con resumen y chips', async ({ page }) => {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');

    await expect(page.getByText('Lunes 16 nov', { exact: true })).toBeVisible();
    await expect(page.getByText('nov.')).toHaveCount(0);
    await expect(page.getByText('Semana 1 de 15', { exact: true })).toBeVisible();
    const card = page.getByRole('region', { name: 'Tu sesión de hoy' });
    await expect(card.getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();
    await expect(card.getByText('7 ejercicios · ~50 min', { exact: true })).toBeVisible();
    await expect(card.getByText('Bloque 1 · Full body', { exact: true })).toBeVisible();
    await expect(card.getByText('RIR 3-4', { exact: true })).toBeVisible();
  });

  test('AC-3: el desplegable de ejercicios empieza cerrado', async ({ page }) => {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');

    const details = page.locator('details').filter({ hasText: 'Ver los 7 ejercicios' });
    await expect(details).not.toHaveAttribute('open', '');
    await details.getByText('Ver los 7 ejercicios').click();
    await expect(details.getByText('Prensa de piernas')).toBeVisible();
  });

  test('AC-7: el martes es cardio, sin botón ni RIR', async ({ page }) => {
    await freezeClockAt(page, '2026-11-17T08:00:00-06:00');
    await page.goto('/');

    const card = page.getByRole('region', { name: 'Tu sesión de hoy' });
    await expect(card.getByRole('heading', { level: 2, name: 'Cardio' })).toBeVisible();
    await expect(card.getByText('Cardio suave 30-40 min', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toHaveCount(0);
    await expect(page.getByText('RIR 3-4')).toHaveCount(0);
  });

  test('AC-9: antes del programa solo la fecha, sin tira', async ({ page }) => {
    // A fresh database starts the program on the Monday of the first visit's week (RN-PLN-13), so
    // the program is anchored on Monday the 16th first, and the clock then goes back a day.
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');
    await expect(page.getByText('Lunes 16 nov', { exact: true })).toBeVisible();
    await freezeClockAt(page, '2026-11-15T08:00:00-06:00');
    await page.reload();

    await expect(page.getByText('Domingo 15 nov', { exact: true })).toBeVisible();
    await expect(page.getByText('El plan empieza el lunes 16 de noviembre.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Semana' })).toHaveCount(0);
    await expect(page.getByText('Otra sesión de esta semana')).toHaveCount(0);
  });

  test('AC-2: "Empezar sesión" abre el primer ejercicio', async ({ page }) => {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');

    await page.getByRole('button', { name: 'Empezar sesión' }).click();

    await expect(page).toHaveURL(/\/sesion\/[^/]+\/1$/);
  });

  test('AC-29: sin conexión, "Hoy" se ve igual', async ({ page, context }) => {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');
    await expect(page.getByText('Lunes 16 nov', { exact: true })).toBeVisible();
    await waitForControllingWorker(page);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByText('Lunes 16 nov', { exact: true })).toBeVisible();
    await expect(page.getByText('7 ejercicios · ~50 min', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
  });
});
