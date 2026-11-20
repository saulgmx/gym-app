import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  chooseBackup,
  closeFridayOnWednesday,
  closeMondayWithFlags,
  doSet,
  downloadBackup,
  freezeClockAt,
  NOT_A_BACKUP,
  openTodayOn,
  openWednesday,
  painLevel,
  smallTouchTargets,
  startSession,
  TRAINED_TODAY,
  USER_TIME_ZONE,
  withoutShare,
} from './helpers';
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

    // The exercise menu (spec 004 AC-4, AC-35).
    await page.getByRole('button', { name: 'Ejercicio 3 de 7' }).click();
    await expect(page.getByRole('dialog', { name: 'Full body A' })).toBeVisible();
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

// Spec 004 AC-35: the redesigned session in every state that adds something on screen, with
// 44 px targets; and at 320 px wide with the details and the menu open, without overflowing.
test.describe('spec 004 AC-35: la sesión rediseñada', () => {
  test.use({ timezoneId: USER_TIME_ZONE });

  async function expectAccessible(page: Page) {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await smallTouchTargets(page)).toEqual([]);
  }

  async function openPressDeBanca(page: Page) {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/');
    await page.getByRole('button', { name: 'Empezar sesión' }).click();
    await page.getByRole('link', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Press de banca con barra');
  }

  test('tarjeta compacta y completa, menú, aviso de salida y confirmación', async ({ page }) => {
    await openPressDeBanca(page);
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Ver detalles' }).click();
    await expect(page.getByText('Costillas abajo, sin arco')).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Ejercicio 2 de 7' }).click();
    await expect(page.getByRole('dialog', { name: 'Full body A' })).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Salir de la sesión' }).click();
    const sheet = page.getByRole('dialog', { name: '¿Salir de la sesión?' });
    await expect(sheet).toBeVisible();
    await expectAccessible(page);

    await sheet.getByRole('button', { name: 'Descartar sesión' }).click();
    await expect(page.getByRole('dialog', { name: '¿Descartar la sesión?' })).toBeVisible();
    await expectAccessible(page);
  });

  test.describe('a 320 px de ancho', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    const fits = (page: Page) =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );

    test('con los detalles abiertos, el menú y el aviso, nada desborda', async ({ page }) => {
      await openPressDeBanca(page);
      await page.getByRole('button', { name: 'Ver detalles' }).click();
      expect(await fits(page)).toBe(true);

      await page.getByRole('button', { name: 'Ejercicio 2 de 7' }).click();
      const menu = page.getByRole('dialog', { name: 'Full body A' });
      await expect(menu).toBeVisible();
      // The 7 rows fit the panel's own scroll, never the page's width.
      expect(await menu.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await fits(page)).toBe(true);
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Salir de la sesión' }).click();
      await expect(page.getByRole('dialog', { name: '¿Salir de la sesión?' })).toBeVisible();
      expect(await fits(page)).toBe(true);
    });
  });
});

// Spec 005 AC-47 (plan §7.1): the Cierre, "Hoy" with done days, the pain notice and chip, and the
// exit sheet with four options, without WCAG 2.2 A/AA violations and with 44 px targets; and at
// 320 px wide, without overflowing. The error on saving stays in close-page.test.tsx.
test.describe('spec 005 AC-47: el Cierre y "Hoy" con sesiones hechas', () => {
  test.use({ timezoneId: USER_TIME_ZONE });

  async function expectAccessible(page: Page) {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await smallTouchTargets(page)).toEqual([]);
  }

  /** The longest Cierre: alert band, both warnings of the red flags and a note. */
  async function fillCierre(page: Page) {
    await painLevel(page, 8).click();
    await page.getByRole('checkbox', { name: 'Hormigueo o adormecimiento' }).check();
    await page
      .getByRole('checkbox', { name: 'Problemas de control de vejiga o intestino' })
      .check();
    await expect(page.getByText('Acude a urgencias.', { exact: false })).toBeVisible();
    await page.getByRole('textbox', { name: 'Notas de la sesión (opcional)' }).fill('Buena sesión');
  }

  test('aviso de salida, Cierre vacío y lleno, "Hoy" hecho con aviso y chip, ya guardada', async ({
    page,
  }) => {
    await freezeClockAt(page, '2026-11-16T18:00:00-06:00');
    await page.goto('/');
    const id = await startSession(page);
    await doSet(page, 1, true);

    await page.getByRole('button', { name: 'Salir de la sesión' }).click();
    const sheet = page.getByRole('dialog', { name: '¿Salir de la sesión?' });
    await expect(sheet.locator('a, button')).toHaveCount(4);
    await expectAccessible(page);

    await sheet.getByRole('link', { name: 'Terminar y guardar lo hecho' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sesión terminada' })).toBeVisible();
    await expectAccessible(page);

    await fillCierre(page);
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Guardar sesión' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('note')).toBeVisible();
    await expect(page.getByText('Espalda 8/10', { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Tu sesión de hoy' })
        .getByRole('listitem')
        .filter({ hasText: /^Hecha\s*✓$/ }),
    ).toBeVisible();
    await expectAccessible(page);

    await page.goto(`/sesion/${id}/cierre`);
    await expect(page.getByText('Esta sesión ya está guardada.')).toBeVisible();
    await expectAccessible(page);

    // Wednesday: the done row in "Otra sesión de esta semana".
    await freezeClockAt(page, '2026-11-18T08:00:00-06:00');
    await page.goto('/');
    await expect(page.getByText('Lun 16 · Full body A · hecha')).toBeVisible();
    await expectAccessible(page);
  });

  test('Cierre sin series hechas', async ({ page }) => {
    await freezeClockAt(page, '2026-11-16T18:00:00-06:00');
    await page.goto('/');
    const id = await startSession(page);
    await page.goto(`/sesion/${id}/cierre`);
    await expect(page.getByText('No hay series hechas para guardar.')).toBeVisible();
    await expectAccessible(page);
  });

  test.describe('a 320 px de ancho', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    const fits = (page: Page) =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );

    test('el aviso de salida, el Cierre lleno y "Hoy" con aviso y chip, sin desbordar', async ({
      page,
    }) => {
      await freezeClockAt(page, '2026-11-16T18:00:00-06:00');
      await page.goto('/');
      await startSession(page);
      await doSet(page, 1, true);

      await page.getByRole('button', { name: 'Salir de la sesión' }).click();
      const sheet = page.getByRole('dialog', { name: '¿Salir de la sesión?' });
      await expect(sheet.locator('a, button')).toHaveCount(4);
      expect(await fits(page)).toBe(true);

      await sheet.getByRole('link', { name: 'Terminar y guardar lo hecho' }).click();
      await fillCierre(page);
      expect(await fits(page)).toBe(true);
      // The 11 levels wrap in two rows, each still 44 px (spec §6.1).
      expect(await smallTouchTargets(page)).toEqual([]);

      await page.getByRole('button', { name: 'Guardar sesión' }).click();
      await expect(page.getByRole('note')).toBeVisible();
      await expect(page.getByText('Espalda 8/10', { exact: true })).toBeVisible();
      expect(await fits(page)).toBe(true);
    });
  });
});

// Spec 005b AC-18: "Hoy" with a session closed today (AC-9) and the preview that cannot start
// (AC-13): axe, 44 px, and nothing overflows at 320 px.
test.describe('spec 005b AC-18: "Hoy" y la vista previa con una sesión cerrada hoy', () => {
  test.use({ timezoneId: USER_TIME_ZONE });

  async function expectAccessible(page: Page) {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await smallTouchTargets(page)).toEqual([]);
  }

  const fits = (page: Page) =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );

  for (const viewport of [null, { width: 320, height: 640 }]) {
    test(viewport ? 'a 320 px de ancho' : 'en el viewport por defecto', async ({ page }) => {
      if (viewport) await page.setViewportSize(viewport);
      await openWednesday(page);
      await closeFridayOnWednesday(page);

      await expect(page.getByText('Ya entrenaste hoy (Full body A del viernes).')).toBeVisible();
      await expect(page.getByText(TRAINED_TODAY)).toBeVisible();
      await expectAccessible(page);
      expect(await fits(page)).toBe(true);

      await page.goto('/dia/2026-11-16');
      await expect(page.getByText(TRAINED_TODAY)).toBeVisible();
      await expectAccessible(page);
      expect(await fits(page)).toBe(true);
    });
  }
});

// Spec 006 AC-36: the history list and the details of a session with red flags, a note and items
// without sets, and of one without flags: axe, 44 px, and nothing overflows at 320 px.
test.describe('spec 006 AC-36: el historial', () => {
  test.use({ timezoneId: USER_TIME_ZONE });

  async function expectAccessible(page: Page) {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await smallTouchTargets(page)).toEqual([]);
  }

  const fits = (page: Page) =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );

  for (const viewport of [null, { width: 320, height: 640 }]) {
    test(viewport ? 'a 320 px de ancho' : 'en el viewport por defecto', async ({ page }) => {
      if (viewport) await page.setViewportSize(viewport);
      const monday = await closeMondayWithFlags(page);
      await freezeClockAt(page, '2026-11-18T18:00:00-06:00');
      await page.reload();
      await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
      const friday = await closeFridayOnWednesday(page);

      await page.goto('/historial');
      await expect(page.getByRole('region', { name: 'Semana 1' }).getByRole('link')).toHaveCount(2);
      await expectAccessible(page);
      expect(await fits(page)).toBe(true);

      for (const id of [monday, friday]) {
        await page.goto(`/historial/${id}`);
        await expect(page.getByRole('region', { name: 'Ejercicios' })).toBeVisible();
        await expectAccessible(page);
        expect(await fits(page)).toBe(true);
      }
    });
  }
});

// Spec 007 AC-40 (§8, decision 18 (f)): Ajustes with an error, the restore preview and the section
// after restoring: axe, 44 px, and nothing overflows at 320 px.
test.describe('spec 007 AC-40: Ajustes y la vista previa', () => {
  test.use({ timezoneId: USER_TIME_ZONE });

  async function expectAccessible(page: Page) {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await smallTouchTargets(page)).toEqual([]);
  }

  const fits = (page: Page) =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );

  for (const viewport of [null, { width: 320, height: 640 }]) {
    test(viewport ? 'a 320 px de ancho' : 'en el viewport por defecto', async ({ page }) => {
      if (viewport) await page.setViewportSize(viewport);
      await withoutShare(page);
      await closeMondayWithFlags(page);
      await page.goto('/ajustes');
      const section = page.getByRole('region', { name: 'Respaldo' });

      await chooseBackup(page, NOT_A_BACKUP);
      await expect(section.getByRole('alert')).toBeVisible();
      await expectAccessible(page);
      expect(await fits(page)).toBe(true);

      const download = await downloadBackup(page);
      await chooseBackup(page, await download.path());
      const dialog = page.getByRole('dialog', { name: '¿Restaurar este respaldo?' });
      await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
      await expectAccessible(page);
      expect(await fits(page)).toBe(true);

      await dialog.getByRole('button', { name: 'Reemplazar mis datos' }).click();
      await expect(section.getByRole('status')).toHaveText('Respaldo restaurado.');
      await expectAccessible(page);
      expect(await fits(page)).toBe(true);
    });
  }
});
