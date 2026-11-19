import { expect, test, type Page } from '@playwright/test';
import {
  cierreWithOneSet,
  closeFridayOnWednesday,
  doSet,
  freezeClockAt,
  openWednesday,
  painLevel,
  startSession,
  storedRows,
  TRAINED_TODAY,
  USER_TIME_ZONE,
  waitForControllingWorker,
} from './helpers';

// Spec 005 (Cierre) on the production build; detail in plan §7.1. Each test starts with an empty
// IndexedDB; the program starts on Monday 2026-11-16, Full body A, whose week 1 has 10 sets:
// Prensa, Press de banca and Dominadas 2 each, and 1 of each of the other four.

test.use({ timezoneId: USER_TIME_ZONE });

/** Sets of each exercise of Full body A in week 1, in order. */
const FULL_BODY_A_SETS = [2, 2, 2, 1, 1, 1, 1];
/** Dead bug (exercise 7) is counted in reps: no kilos. */
const REPS_ONLY = 7;

interface StoredWorkout {
  id: string;
  status: string;
  notes?: string;
}
interface StoredPain {
  workoutId: string;
  level: number;
  redFlags: string[];
}

test.describe('spec 005: el Cierre', () => {
  test('AC-1, AC-7, AC-18, AC-32, AC-39: sesión completa, guardada y vista en "Hoy"', async ({
    page,
  }) => {
    // The clock stays fixed while logging, so startedAt is 18:00:00 and the Cierre shows 52 min.
    await freezeClockAt(page, '2026-11-16T18:00:00-06:00');
    await page.goto('/');
    const id = await startSession(page);
    for (const [i, sets] of FULL_BODY_A_SETS.entries()) {
      const exercise = i + 1;
      if (exercise > 1) await page.getByRole('link', { name: 'Siguiente' }).click();
      await expect(page.getByText(`Ejercicio ${String(exercise)} de 7`)).toBeVisible();
      for (let n = 1; n <= sets; n++) await doSet(page, n, exercise !== REPS_ONLY);
    }

    // AC-1: on the last exercise, "Terminar sesión" instead of "Siguiente".
    await expect(page.getByText('Último ejercicio de hoy')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Siguiente' })).toHaveCount(0);
    await freezeClockAt(page, '2026-11-16T18:52:00-06:00');
    await page.getByRole('link', { name: 'Terminar sesión' }).click();

    // AC-7: heading and summary.
    await expect(page).toHaveURL(`/sesion/${id}/cierre`);
    await expect(page.getByRole('heading', { level: 1, name: 'Sesión terminada' })).toBeVisible();
    await expect(page.getByText('Lunes 16 de noviembre · Full body A')).toBeVisible();
    for (const figure of ['52 min', '10 series', '7 ejercicios']) {
      await expect(page.getByText(figure, { exact: true })).toBeVisible();
    }

    // AC-10, AC-11, AC-12: the level enables saving.
    const save = page.getByRole('button', { name: 'Guardar sesión' });
    await expect(save).toBeDisabled();
    await expect(page.getByText('Elige el nivel de dolor para poder guardar')).toBeVisible();
    await page
      .getByRole('group', { name: 'Dolor lumbar' })
      .getByRole('button', { name: '5', exact: true })
      .click();
    await expect(
      page.getByText(
        'Molestia alta. Baja la carga la próxima sesión y evita los ejercicios que la provocaron.',
      ),
    ).toBeVisible();
    await page.getByRole('textbox', { name: 'Notas de la sesión (opcional)' }).fill('Buena sesión');
    await save.click();

    // AC-18: saved, back on "Hoy" with replace.
    await expect(page).toHaveURL('/');
    const [workout] = await storedRows<StoredWorkout>(page, 'workouts');
    expect(workout).toMatchObject({ id, status: 'completed', notes: 'Buena sesión' });
    expect(await storedRows<StoredPain>(page, 'painEntries')).toEqual([
      expect.objectContaining({ workoutId: id, level: 5, redFlags: [] }),
    ]);

    // Back does not reopen the Cierre: the last exercise, already saved (plan §7.1).
    await page.goBack();
    await expect(page).toHaveURL(`/sesion/${id}/7`);
    await expect(page.getByText('Esta sesión ya está guardada.')).toBeVisible();

    // AC-32, AC-39: Wednesday 18.
    await freezeClockAt(page, '2026-11-18T08:00:00-06:00');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'lunes, Full body A, hecha' })).toBeVisible();
    await expect(page.getByText('1 de 3 sesiones', { exact: true })).toBeVisible();
    const others = page.getByRole('region', { name: 'Otra sesión de esta semana' });
    await expect(others.getByText('Lun 16 · Full body A · hecha')).toBeVisible();
    await expect(others.getByRole('link', { name: /Lun 16/ })).toHaveCount(0);
    await expect(others.getByRole('link', { name: 'Vie 20 · Full body A' })).toBeVisible();
    await expect(page.getByRole('note')).toHaveText(
      'Espalda baja 5/10 en la última sesión. Hoy baja la carga y evita los ejercicios que la provocaron.',
    );
    await expect(page.getByText('Espalda 5/10', { exact: true })).toBeVisible();
  });

  test('AC-4, AC-5, AC-8, AC-22, AC-43: sesión parcial desde el aviso de salida', async ({
    page,
  }) => {
    // The partial example: both sets of Prensa, the first of Press de banca, both of Dominadas.
    await freezeClockAt(page, '2026-11-16T18:00:00-06:00');
    await page.goto('/');
    const id = await startSession(page);
    for (const [exercise, sets] of [
      [1, 2],
      [2, 1],
      [3, 2],
    ] as const) {
      if (exercise > 1) await page.getByRole('link', { name: 'Siguiente' }).click();
      await expect(page.getByText(`Ejercicio ${String(exercise)} de 7`)).toBeVisible();
      for (let n = 1; n <= sets; n++) await doSet(page, n, true);
    }
    await freezeClockAt(page, '2026-11-16T18:30:00-06:00');

    // AC-4: four options, in order; AC-5: "Terminar y guardar lo hecho" opens the Cierre.
    const openCierreFromSheet = async () => {
      await page.getByRole('button', { name: 'Salir de la sesión' }).click();
      const sheet = page.getByRole('dialog', { name: '¿Salir de la sesión?' });
      await expect(sheet.locator('a, button')).toHaveText([
        /^Seguir entrenando$/,
        /^Terminar y guardar lo hecho\s+Irás al cierre para registrar el dolor$/,
        /^Salir y continuar después/,
        /^Descartar sesión/,
      ]);
      await sheet.getByRole('link', { name: 'Terminar y guardar lo hecho' }).click();
      await expect(page).toHaveURL(`/sesion/${id}/cierre`);
    };
    await openCierreFromSheet();

    // AC-8: the same heading, and the partial summary.
    await expect(page.getByRole('heading', { level: 1, name: 'Sesión terminada' })).toBeVisible();
    for (const figure of ['30 min', '5 series', '3 de 7 ejercicios']) {
      await expect(page.getByText(figure, { exact: true })).toBeVisible();
    }

    // "Volver a la sesión" goes back to where the Cierre was opened, here exercise 3, not to the
    // current one of RN-TRN-21 (2: the second set of Press de banca is pending), so it proves the
    // navigation state (plan §6.6). Nothing chosen is kept.
    const levels = page.getByRole('group', { name: 'Dolor lumbar' });
    const back = async (exercise: number) => {
      await page.getByRole('link', { name: 'Volver a la sesión' }).click();
      await expect(page).toHaveURL(`/sesion/${id}/${String(exercise)}`);
      await expect(page.getByText(`Ejercicio ${String(exercise)} de 7`)).toBeVisible();
    };
    await levels.getByRole('button', { name: '4', exact: true }).click();
    await back(3);

    // AC-22: from exercise 2, back to 2; the level starts unchosen again.
    await page.getByRole('link', { name: 'Anterior' }).click();
    await expect(page.getByText('Ejercicio 2 de 7')).toBeVisible();
    await openCierreFromSheet();
    await expect(levels.locator('[aria-pressed="true"]')).toHaveCount(0);
    await levels.getByRole('button', { name: '4', exact: true }).click();
    await back(2);
    await openCierreFromSheet();
    await expect(levels.locator('[aria-pressed="true"]')).toHaveCount(0);
    expect(await storedRows<StoredPain>(page, 'painEntries')).toEqual([]);

    // AC-14: a red flag shows its warning in the Cierre.
    await levels.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Hormigueo o adormecimiento' }).check();
    await expect(
      page.getByText(
        'Consulta a un médico antes de seguir entrenando. No se sugerirá subir carga.',
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Guardar sesión' }).click();

    // AC-20: completed with the 5 undone sets kept; AC-18: the pain with its flag.
    await expect(page).toHaveURL('/');
    const [workout] = await storedRows<StoredWorkout>(page, 'workouts');
    expect(workout).toMatchObject({ id, status: 'completed' });
    expect(workout?.notes).toBeUndefined();
    const sets = await storedRows<{ done: boolean }>(page, 'sets');
    expect(sets.filter((s) => s.done)).toHaveLength(5);
    expect(sets.filter((s) => !s.done)).toHaveLength(5);
    expect(await storedRows<StoredPain>(page, 'painEntries')).toEqual([
      expect.objectContaining({ workoutId: id, level: 2, redFlags: ['numbness'] }),
    ]);

    // AC-34 on the same Monday, AC-43: the done card, the red-flag notice and the chip.
    const card = page.getByRole('region', { name: 'Tu sesión de hoy' });
    await expect(card.getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();
    // The chip shows "Hecha ✓"; the ✓ is aria-hidden, so it reads "Hecha".
    await expect(card.getByRole('listitem').filter({ hasText: /^Hecha\s*✓$/ })).toBeVisible();
    await expect(card.getByText('30 min · 5 series', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Empezar sesión' })).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'lunes, hoy, Full body A, hecha' })).toBeVisible();
    await expect(page.getByRole('note')).toHaveText(
      'En la última sesión marcaste una señal de alarma. Consulta a un médico antes de seguir entrenando.',
    );
    await expect(card.getByText('Espalda 2/10', { exact: true })).toBeVisible();
  });

  test('AC-24: salir del Cierre sin guardar, con "atrás" o abriendo "Hoy", no guarda nada', async ({
    page,
  }) => {
    await freezeClockAt(page, '2026-11-16T18:00:00-06:00');
    await page.goto('/');
    const id = await cierreWithOneSet(page);
    const nothingSaved = async () => {
      const [workout] = await storedRows<StoredWorkout>(page, 'workouts');
      expect(workout).toMatchObject({ id, status: 'in_progress' });
      expect(await storedRows<StoredPain>(page, 'painEntries')).toEqual([]);
    };

    // "Atrás": the Cierre has no tab bar (spec §8, decision 18), so back is the session.
    await painLevel(page, 3).click();
    await page.goBack();
    await expect(page).toHaveURL(`/sesion/${id}/1`);
    await expect(page.getByRole('checkbox', { name: 'Serie 1 hecha' })).toBeChecked();
    await nothingSaved();

    // Opening "Hoy" again, as when the app is reopened.
    await page.getByRole('button', { name: 'Salir de la sesión' }).click();
    await page
      .getByRole('dialog', { name: '¿Salir de la sesión?' })
      .getByRole('link', { name: 'Terminar y guardar lo hecho' })
      .click();
    await painLevel(page, 3).click();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Continuar sesión' })).toBeVisible();
    await nothingSaved();
  });

  test('AC-48: sin conexión, se cierra y se guarda igual', async ({ page, context }) => {
    await freezeClockAt(page, '2026-11-16T18:00:00-06:00');
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
    await waitForControllingWorker(page);

    await context.setOffline(true);
    const id = await cierreWithOneSet(page);
    await painLevel(page, 0).click();
    await page.getByRole('button', { name: 'Guardar sesión' }).click();

    await expect(page).toHaveURL('/');
    const card = page.getByRole('region', { name: 'Tu sesión de hoy' });
    await expect(card.getByRole('listitem').filter({ hasText: /^Hecha\s*✓$/ })).toBeVisible();
    const [workout] = await storedRows<StoredWorkout>(page, 'workouts');
    expect(workout).toMatchObject({ id, status: 'completed' });
    expect(await storedRows<StoredPain>(page, 'painEntries')).toEqual([
      expect.objectContaining({ workoutId: id, level: 0, redFlags: [] }),
    ]);
  });

  // AC-17: Playwright does not emulate the safe area (env() is 0; checked on the iPhone, T23), so
  // this checks the fixed footer's sizes and that it never covers the end of the content.
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 390, height: 664 }, // iPhone 13
  ]) {
    test.describe(`AC-17: pie fijo a ${String(viewport.width)} × ${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('"Guardar sesión" y "Volver a la sesión" fijos, sin tapar el contenido', async ({
        page,
      }) => {
        await freezeClockAt(page, '2026-11-16T18:00:00-06:00');
        await page.goto('/');
        await cierreWithOneSet(page);
        // The longest Cierre: alert band, the urgent red-flag warning and a note.
        await painLevel(page, 8).click();
        await page.getByRole('checkbox', { name: 'Hormigueo o adormecimiento' }).check();
        await page
          .getByRole('checkbox', { name: 'Problemas de control de vejiga o intestino' })
          .check();
        const notes = page.getByRole('textbox', { name: 'Notas de la sesión (opcional)' });
        await notes.fill('Buena sesión');

        const save = page.getByRole('button', { name: 'Guardar sesión' });
        const back = page.getByRole('link', { name: 'Volver a la sesión' });
        const footer = page.locator('footer').filter({ has: save });
        const box = async (locator: typeof save) => {
          const b = await locator.boundingBox();
          if (!b) throw new Error('Not rendered');
          return b;
        };

        // At the top, the footer is already at the bottom of the viewport.
        const top = await box(footer);
        expect(top.y + top.height).toBeCloseTo(viewport.height, 0);

        await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
        });
        const [end, fixed] = [await box(notes), await box(footer)];
        expect(fixed.y + fixed.height).toBeCloseTo(viewport.height, 0);
        expect(end.y + end.height).toBeLessThanOrEqual(fixed.y);
        expect((await box(save)).height).toBeGreaterThanOrEqual(56);
        expect((await box(back)).height).toBeGreaterThanOrEqual(48);
      });
    });
  }
});

// Spec 005b (RN-TRN-27): one closed session per day. Detail in plan §7.
test.describe('spec 005b: una sola sesión cerrada por día', () => {
  interface StoredDay extends StoredWorkout {
    date: string;
    plannedFor: string;
  }

  /** "Hoy" on Wednesday after closing Friday's session that day (AC-8, AC-9). */
  async function expectWednesdayTrained(page: Page) {
    const card = page.getByRole('region', { name: 'Tu sesión de hoy' });
    await expect(card.getByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
    await expect(card.getByText('Ya entrenaste hoy (Full body A del viernes).')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toHaveCount(0);
    const others = page.getByRole('region', { name: 'Otra sesión de esta semana' });
    await expect(others.getByText(TRAINED_TODAY)).toBeVisible();
    await expect(others.getByText(/^Vie 20 · Full body A · hecha/)).toBeVisible();
  }

  test('AC-8, AC-9, AC-13, AC-14: el viernes hecho el miércoles; "Hoy" y las vistas previas ya no dejan empezar', async ({
    page,
  }) => {
    await openWednesday(page);
    const id = await closeFridayOnWednesday(page);

    await expectWednesdayTrained(page);
    expect(await storedRows<StoredDay>(page, 'workouts')).toEqual([
      expect.objectContaining({
        id,
        status: 'completed',
        date: '2026-11-18',
        plannedFor: '2026-11-20',
      }),
    ]);

    // AC-14: Friday itself is done, which wins.
    await page.goto('/dia/2026-11-20');
    await expect(page.getByText('Ya hiciste esta sesión.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toHaveCount(0);

    // AC-13: Monday is not done, but today is already trained.
    await page.goto('/dia/2026-11-16');
    await expect(page.getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();
    await expect(page.getByText(TRAINED_TODAY)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toHaveCount(0);
  });

  test('AC-19: sin conexión, igual', async ({ page, context }) => {
    await openWednesday(page);
    await waitForControllingWorker(page);

    await context.setOffline(true);
    await closeFridayOnWednesday(page);

    await expectWednesdayTrained(page);
    await page
      .getByRole('region', { name: 'Otra sesión de esta semana' })
      .getByRole('link', { name: 'Lun 16 · Full body A' })
      .click();
    await expect(page).toHaveURL('/dia/2026-11-16');
    await expect(page.getByText(TRAINED_TODAY)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toHaveCount(0);
  });
});
