import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { freezeClockAt, openTodayOn, smallTouchTargets, USER_TIME_ZONE } from './helpers';
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

// Spec 003 AC-27: "Hoy" in states D (workout, cardio, outside the program) and D2, without WCAG 2.2
// A/AA violations and with every touch target of at least 44 × 44 px.
test.describe('AC-27: el rediseño de "Hoy"', () => {
  test.use({ timezoneId: USER_TIME_ZONE });

  async function expectAccessible(page: Page) {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await smallTouchTargets(page)).toEqual([]);
  }

  test('D en un día de pesas, con la lista de ejercicios abierta', async ({ page }) => {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();
    await expectAccessible(page);

    await page.getByText('Ver los 7 ejercicios').click();
    await expect(page.getByText('Prensa de piernas')).toBeVisible();
    await expectAccessible(page);
  });

  test('D en un día de cardio', async ({ page }) => {
    await freezeClockAt(page, '2026-11-17T08:00:00-06:00');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2, name: 'Cardio' })).toBeVisible();
    await expectAccessible(page);
  });

  test('D fuera del programa', async ({ page }) => {
    await openTodayOn(page, '2026-11-15T08:00:00-06:00');
    await expect(page.getByText('El plan empieza el lunes 16 de noviembre.')).toBeVisible();
    await expectAccessible(page);
  });

  test('D2, con una serie hecha', async ({ page }) => {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');
    await page.getByRole('button', { name: 'Empezar sesión' }).click();
    // A set is marked done only with its values (RN-TRN-04).
    for (const [name, value] of [
      ['Serie 1, kilos', '60'],
      ['Serie 1, repeticiones', '10'],
      ['Serie 1, RIR', '3'],
    ] as const) {
      const field = page.getByRole('textbox', { name });
      await field.fill(value);
      await field.press('Enter');
    }
    await page.getByRole('checkbox', { name: 'Serie 1 hecha' }).click();
    await expect(page.getByRole('checkbox', { name: 'Serie 1 hecha' })).toBeChecked();
    await page.goto('/');
    const card = page.getByRole('region', { name: 'Sesión en curso' });
    await expect(
      card.getByText('Vas en: Prensa de piernas · serie 2', { exact: true }),
    ).toBeVisible();
    await expectAccessible(page);
  });
});

// Spec 003 AC-27 and plan §8: the 44 px title and the chips at 320 px wide, without overflowing.
// Monday 16 has the longest session name of the seed ("Full body A"), Monday 2027-01-11 (week 9)
// the longest chip ("Bloque 3 · PPL + Upper/Lower").
test.describe('AC-27: "Hoy" a 320 px de ancho', () => {
  test.use({ timezoneId: USER_TIME_ZONE, viewport: { width: 320, height: 640 } });

  for (const { at, title, chip } of [
    { at: '2026-11-16T08:00:00-06:00', title: 'Full body A', chip: 'Bloque 1 · Full body' },
    { at: '2027-01-11T08:00:00-06:00', title: 'Push', chip: 'Bloque 3 · PPL + Upper/Lower' },
  ]) {
    test(`${title}: ni el título ni la página desbordan`, async ({ page }) => {
      await openTodayOn(page, at);
      const heading = page.getByRole('heading', { level: 2, name: title });
      await expect(heading).toBeVisible();
      await expect(page.getByText(chip, { exact: true })).toBeVisible();

      expect(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      const page320 = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(page320.client).toBe(320);
      expect(page320.scroll).toBeLessThanOrEqual(page320.client);
    });
  }
});
