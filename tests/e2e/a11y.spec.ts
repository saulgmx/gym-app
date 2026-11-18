import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { freezeClockAt, smallTouchTargets, USER_TIME_ZONE } from './helpers';
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

// Spec 002 AC-39: the active session, "Hoy" with it, the discard dialog and another day, with
// every touch target of at least 44 × 44 px. Each screen is checked once its content is loaded.
test.describe('AC-39: la sesión activa', () => {
  test.use({ timezoneId: USER_TIME_ZONE });

  async function expectAccessible(page: Page) {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await smallTouchTargets(page)).toEqual([]);
  }

  test('la sesión, con un error y con la lista de ejercicios abierta', async ({ page }) => {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');
    await page.getByRole('button', { name: 'Empezar sesión' }).click();
    // Dominadas: the assistance switch is on screen too.
    await page.getByRole('link', { name: 'Siguiente' }).click();
    await page.getByRole('link', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dominadas');
    await expectAccessible(page);

    const kilos = page.getByRole('textbox', { name: 'Serie 1, kilos' });
    await kilos.fill('abc');
    await kilos.press('Enter');
    await expect(page.getByText('Escribe un número.')).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Ver ejercicios' }).click();
    await expect(page.getByRole('button', { name: 'Descartar sesión' })).toBeVisible();
    await expectAccessible(page);
  });

  test('"Hoy" con sesión activa y el diálogo de descarte', async ({ page }) => {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');
    await page.getByRole('button', { name: 'Empezar sesión' }).click();
    await expect(page.getByText('Ejercicio 1 de 7')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Continuar sesión' })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Descartar sesión' }).click();
    await expect(page.getByRole('dialog', { name: '¿Descartar la sesión?' })).toBeVisible();
    await expectAccessible(page);
  });

  test('otro día de la semana', async ({ page }) => {
    await freezeClockAt(page, '2026-11-21T08:00:00-06:00');
    await page.goto('/dia/2026-11-20');
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
    await expectAccessible(page);
  });
});
