import { expect, test, type Page } from '@playwright/test';
import {
  closeFridayOnWednesday,
  closeMondayWithFlags,
  freezeClockAt,
  USER_TIME_ZONE,
  waitForControllingWorker,
} from './helpers';

// Spec 006 (plan §7): the history list and the session detail on the production build, reached
// from "Hoy" and from the tab, with and without a connection. Monday 16: Full body A with one set,
// pain 5 and "Hormigueo"; Wednesday 18: Friday's Full body A with one set and pain 0.

test.use({ timezoneId: USER_TIME_ZONE });

/** The detail of Monday's session (AC-14, AC-16, AC-18, AC-25, AC-26). */
async function expectMondayDetail(page: Page, id: string) {
  await expect(page).toHaveURL(`/historial/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Full body A' })).toBeVisible();
  await expect(page.getByText('Lunes 16 de noviembre · Semana 1', { exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Full body A · Historial · Gym');
  const pain = page.getByRole('region', { name: 'Dolor lumbar' });
  await expect(pain.getByText('5/10', { exact: true })).toBeVisible();
  await expect(pain.getByText('Señales de alarma: Hormigueo o adormecimiento')).toBeVisible();
  const prensa = page
    .getByRole('region', { name: 'Ejercicios' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: 'Prensa de piernas' }) });
  await expect(prensa.getByText('1 · 40 × 10 · RIR 3', { exact: true })).toBeVisible();
  await expect(page.getByText('Sin series', { exact: true })).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Notas' })).toContainText('Buena sesión');
  await expect(page.getByRole('link', { name: 'Historial' })).toHaveAttribute(
    'aria-current',
    'page',
  );
}

test.describe('spec 006: el historial', () => {
  test('AC-1, AC-5 a AC-9, AC-14 a AC-28, AC-33, AC-34: de "Hoy" al detalle y de la pestaña a la lista', async ({
    page,
  }) => {
    const monday = await closeMondayWithFlags(page);

    // AC-33: the done card of "Hoy" opens the detail, and "Volver" comes back to "Hoy".
    await page.getByRole('link', { name: 'Ver detalle' }).click();
    await expectMondayDetail(page, monday);
    await page.getByRole('link', { name: 'Volver' }).click();
    await expect(page).toHaveURL('/');

    // Wednesday 18: Friday's session, done that day.
    await freezeClockAt(page, '2026-11-18T18:00:00-06:00');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
    const friday = await closeFridayOnWednesday(page);

    // AC-34: the done row of "Otra sesión de esta semana" opens the detail.
    await page
      .getByRole('region', { name: 'Otra sesión de esta semana' })
      .getByRole('link', { name: 'Lun 16 · Full body A · hecha' })
      .click();
    await expectMondayDetail(page, monday);
    await page.getByRole('link', { name: 'Volver' }).click();
    await expect(page).toHaveURL('/');

    // AC-1, AC-2: the tab opens the list.
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Historial' })
      .click();
    await expect(page).toHaveURL('/historial');
    await expect(page).toHaveTitle('Historial · Gym');
    const week = page.getByRole('region', { name: 'Semana 1' });
    await expect(week.getByText('Bloque 1 · Full body · 16-22 nov')).toBeVisible();
    const rows = week.getByRole('link');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('href', `/historial/${friday}`);
    await expect(rows.nth(0)).toContainText('Mié 18 · Full body A del viernes');
    await expect(rows.nth(0)).toContainText('Espalda 0/10');
    await expect(rows.nth(1)).toContainText('Lun 16 · Full body A');
    await expect(rows.nth(1)).toContainText('1 serie · 1 de 7 ejercicios');
    await expect(rows.nth(1)).toContainText('Señal de alarma');

    // AC-9, AC-15, AC-27: a row opens its detail, and "Volver" comes back to the list.
    await rows.nth(0).click();
    await expect(
      page.getByText('Miércoles 18 de noviembre · Semana 1 · sesión del viernes', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Volver' }).click();
    await expect(page).toHaveURL('/historial');
  });

  test('AC-37: sin conexión, el detalle y la lista funcionan igual', async ({ page, context }) => {
    const monday = await closeMondayWithFlags(page, async () => {
      await waitForControllingWorker(page);
      await context.setOffline(true);
    });

    await page.getByRole('link', { name: 'Ver detalle' }).click();
    await expectMondayDetail(page, monday);
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Historial' })
      .click();
    await expect(page).toHaveURL('/historial');
    await page.getByRole('region', { name: 'Semana 1' }).getByRole('link').click();
    await expectMondayDetail(page, monday);
  });
});
