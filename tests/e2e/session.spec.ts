import { expect, test, type Page } from '@playwright/test';
import {
  freezeClockAt,
  installClockAt,
  storedStartedAt,
  USER_TIME_ZONE,
  waitForControllingWorker,
  waitForStoredSet,
} from './helpers';

// The active session on the production build (spec 002 AC-2, AC-4, AC-8, AC-21, AC-34, AC-36;
// QS-03, QS-05). Each test starts with an empty IndexedDB; the program starts on Monday
// 2026-11-16, Full body A: Prensa de piernas (2 sets), Press de banca con barra (2 sets), ...

test.use({ timezoneId: USER_TIME_ZONE });

const MONDAY = '2026-11-16T08:00:00-06:00';
const SATURDAY = '2026-11-21T08:00:00-06:00';

/** The workout ID in a /sesion/<id>/<n> URL. */
const SESSION_URL = /\/sesion\/([^/]+)\/(\d+)$/;

async function startFromToday(page: Page) {
  await page.getByRole('button', { name: 'Empezar sesión' }).click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(page.getByText('Ejercicio 1 de 7')).toBeVisible();
}

/** Types a value and confirms it with Enter, as on the phone keyboard. */
async function type(page: Page, name: string, value: string) {
  const field = page.getByRole('textbox', { name });
  await field.fill(value);
  await field.press('Enter');
}

async function logSet(page: Page, n: number, values: { kg: string; reps: string; rir: string }) {
  await type(page, `Serie ${String(n)}, kilos`, values.kg);
  await type(page, `Serie ${String(n)}, repeticiones`, values.reps);
  await type(page, `Serie ${String(n)}, RIR`, values.rir);
}

async function markDone(page: Page, n: number) {
  const check = page.getByRole('checkbox', { name: `Serie ${String(n)} hecha` });
  await check.click();
  await expect(check).toBeChecked();
}

test('AC-4, QS-03: registrar, recargar y continuar en el ejercicio pendiente', async ({ page }) => {
  await freezeClockAt(page, MONDAY);
  await page.goto('/');
  await startFromToday(page);
  const workoutId = SESSION_URL.exec(page.url())?.[1];

  await logSet(page, 1, { kg: '60', reps: '10', rir: '3' });
  await markDone(page, 1);
  // RN-TRN-11: the next set already has the weight.
  await expect(page.getByRole('textbox', { name: 'Serie 2, kilos' })).toHaveValue('60');
  await logSet(page, 2, { kg: '60', reps: '9', rir: '2' });
  await markDone(page, 2);
  await page.getByRole('link', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Press de banca con barra');
  await logSet(page, 1, { kg: '40', reps: '8', rir: '3' });
  await markDone(page, 1);
  await type(page, 'Serie 2, kilos', '62,5');
  await waitForStoredSet(page, (s) => s.weightKg === 62.5);

  await page.reload();
  await page.goto('/');
  await page.getByRole('link', { name: 'Continuar sesión' }).click();

  await expect(page).toHaveURL(`/sesion/${workoutId ?? ''}/2`);
  await expect(page.getByRole('checkbox', { name: 'Serie 1 hecha' })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Serie 2, kilos' })).toHaveValue('62,5');
  await page.getByRole('link', { name: 'Anterior' }).click();
  await expect(page.getByRole('checkbox', { name: 'Serie 2 hecha' })).toBeChecked();
});

test('AC-36: sin conexión se inicia, se registra y se conserva al recargar', async ({
  page,
  context,
}) => {
  await freezeClockAt(page, MONDAY);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
  await waitForControllingWorker(page);

  await context.setOffline(true);
  await startFromToday(page);
  await logSet(page, 1, { kg: '60', reps: '10', rir: '3' });
  await markDone(page, 1);
  await type(page, 'Serie 2, repeticiones', '9');
  await waitForStoredSet(page, (s) => s.reps === 9);
  await page.reload();

  await expect(page.getByRole('checkbox', { name: 'Serie 1 hecha' })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Serie 1, kilos' })).toHaveValue('60');
  await expect(page.getByRole('textbox', { name: 'Serie 2, repeticiones' })).toHaveValue('9');
});

test('AC-8: el sábado se hace la sesión del viernes', async ({ page }) => {
  await freezeClockAt(page, SATURDAY);
  await page.goto('/');

  await page.getByRole('link', { name: 'Vie 20 · Full body A' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Viernes 20 de noviembre' }),
  ).toBeVisible();
  await startFromToday(page);

  await expect(page.getByText('Full body A')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prensa de piernas');
  await page.goto('/');
  // Started today: no date after "Continuar sesión".
  await expect(page.getByRole('link', { name: 'Continuar sesión', exact: true })).toBeVisible();
});

test('AC-34: descartar pide confirmación, vuelve a "Hoy" y deja iniciar otra', async ({ page }) => {
  await freezeClockAt(page, MONDAY);
  await page.goto('/');
  await startFromToday(page);
  await page.getByRole('button', { name: 'Ver ejercicios' }).click();
  await page.getByRole('button', { name: 'Descartar sesión' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Descartar la sesión?' });

  // Cancel first: nothing changes, and focus starts on Cancelar (P-2).
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(SESSION_URL);

  // The list stays open after cancelling.
  await page.getByRole('button', { name: 'Descartar sesión' }).click();
  await dialog.getByRole('button', { name: 'Sí, descartar' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(SESSION_URL); // replace: no way back into the discarded one
});

// Two clicks from Playwright never land at the same instant: the second tab often sees the session
// of the first one before its click, its button gives way to "Continuar sesión" and the click
// waits forever (flaky in WebKit). So the e2e checks what a user sees, one tab after the other.
// Two startWorkout at the same time are covered by dexie-repository.test.ts (AC-2), and a stale
// "Empezar sesión" that gets already-active by today-session.test.tsx.
test('AC-2: la segunda pestaña ve la sesión de la primera y entra en la misma', async ({
  context,
}) => {
  const [first, second] = [await context.newPage(), await context.newPage()];
  for (const page of [first, second]) {
    await freezeClockAt(page, MONDAY);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
  }

  await startFromToday(first);
  // Without reloading: "Hoy" follows IndexedDB across tabs (RN-TRN-19).
  await expect(second.getByRole('button', { name: 'Empezar sesión' })).toBeHidden();
  await second.getByRole('link', { name: 'Continuar sesión' }).click();

  await expect(second).toHaveURL(SESSION_URL);
  const ids = [first, second].map((page) => SESSION_URL.exec(page.url())?.[1]);
  expect(ids[0]).toBeDefined();
  expect(ids[1]).toBe(ids[0]);
});

test('AC-21, QS-05: marcar una serie se ve en menos de 100 ms', async ({ page, browserName }) => {
  await freezeClockAt(page, MONDAY);
  await page.goto('/');
  await startFromToday(page);
  await logSet(page, 1, { kg: '60', reps: '10', rir: '3' });

  // From the click to the row turning "done" (after the write to IndexedDB), measured in the page.
  await page.evaluate(() => {
    const check = document.querySelector<HTMLInputElement>('input[aria-label="Serie 1 hecha"]');
    const row = check?.closest('tr');
    if (!check || !row) throw new Error('No row for set 1');
    const timing = window as unknown as { checkMs?: Promise<number> };
    timing.checkMs = new Promise((resolve) => {
      let start = 0;
      check.addEventListener('click', () => (start = performance.now()), { capture: true });
      new MutationObserver((_, observer) => {
        if (row.className.includes('done') && check.checked) {
          observer.disconnect();
          resolve(performance.now() - start);
        }
      }).observe(row, { attributes: true, subtree: true });
    });
  });
  await page.getByRole('checkbox', { name: 'Serie 1 hecha' }).click();
  const ms = await page.evaluate(() => (window as unknown as { checkMs: Promise<number> }).checkMs);

  test.info().annotations.push({ type: 'check-ms', description: `${ms.toFixed(1)} ms` });
  console.log(`AC-21 ${browserName}: ${ms.toFixed(1)} ms`);
  // WebKit only logs: CI timing varies too much there (plan §7).
  if (browserName === 'chromium') expect(ms).toBeLessThan(100);
});

// Spec 003, state D2 ("Sesión en curso") on the production build. The example of §4.5: Full body A
// started on Monday 2026-11-16 at 18:00 with both sets of Prensa and the first of Press de banca
// done.

/** Starts Full body A and logs the example: Prensa (2 sets) and the first set of Press de banca. */
async function logExampleSets(page: Page) {
  await page.goto('/');
  await startFromToday(page);
  await logSet(page, 1, { kg: '60', reps: '10', rir: '3' });
  await markDone(page, 1);
  await logSet(page, 2, { kg: '60', reps: '9', rir: '2' });
  await markDone(page, 2);
  await page.getByRole('link', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Press de banca con barra');
  await logSet(page, 1, { kg: '40', reps: '8', rir: '3' });
  await markDone(page, 1);
  await waitForStoredSet(page, (s) => s.weightKg === 40);
  // The session has no tab bar: leaving is a reload, which rebuilds "Hoy" from IndexedDB.
  await page.goto('/');
}

test('AC-16, AC-17, AC-18: la tarjeta de sesión en curso, el tiempo y "Continuar sesión"', async ({
  page,
}) => {
  // Timers are faked from 18:00 and keep flowing while the page loads: with the clock paused from
  // the start, "Hoy" never left its loading state (only the hidden h1), in both browsers. Once the
  // card is on screen, the clock is paused 18 min 42 s after the stored startedAt (saved in whole
  // seconds), not at 18:18:42: on a slow CI runner the start lands at 18:00:01 and would show
  // "18:41". From then on only runFor moves it.
  await installClockAt(page, '2026-11-16T18:00:00-06:00');
  await logExampleSets(page);
  const card = page.getByRole('region', { name: 'Sesión en curso' });
  await expect(card.getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();

  const startedAt = Date.parse(await storedStartedAt(page));
  await page.clock.pauseAt(startedAt + (18 * 60 + 42) * 1000);

  await expect(card.getByText('18:42', { exact: true })).toBeVisible();
  await expect(card.getByText('1 de 7 ejercicios hechos', { exact: true })).toBeVisible();
  await expect(card.getByText('Faltan ~25 min', { exact: true })).toBeVisible();
  await expect(
    card.getByText('Vas en: Press de banca con barra · serie 2', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Tu sesión de hoy')).toHaveCount(0);
  await expect(page.getByText('Otra sesión de esta semana')).toHaveCount(0);

  await page.clock.runFor(1000);
  await expect(card.getByText('18:43', { exact: true })).toBeVisible();

  await card.getByRole('link', { name: 'Continuar sesión' }).click();
  await expect(page).toHaveURL(/\/sesion\/[^/]+\/2$/);
});

test('AC-25: descartar desde "Hoy" vuelve al estado D; cancelar no cambia nada', async ({
  page,
}) => {
  await freezeClockAt(page, MONDAY);
  await logExampleSets(page);
  const card = page.getByRole('region', { name: 'Sesión en curso' });
  await card.getByRole('button', { name: 'Descartar sesión' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Descartar la sesión?' });
  await expect(
    dialog.getByText(
      'Las 3 series que registraste en 2 ejercicios no contarán en tu historial. No se puede deshacer.',
    ),
  ).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect(card.getByText('1 de 7 ejercicios hechos', { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Descartar sesión' }).click();
  await dialog.getByRole('button', { name: 'Sí, descartar' }).click();

  await expect(page.getByRole('region', { name: 'Tu sesión de hoy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sesión en curso' })).toHaveCount(0);
});

test('AC-29: sin conexión, la sesión en curso se ve igual en "Hoy"', async ({ page, context }) => {
  await freezeClockAt(page, MONDAY);
  await page.goto('/');
  await startFromToday(page);
  await logSet(page, 1, { kg: '60', reps: '10', rir: '3' });
  await markDone(page, 1);
  await waitForStoredSet(page, (s) => s.weightKg === 60);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Continuar sesión' })).toBeVisible();
  await waitForControllingWorker(page);

  await context.setOffline(true);
  await page.reload();

  const card = page.getByRole('region', { name: 'Sesión en curso' });
  await expect(card.getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();
  await expect(card.getByText('0 de 7 ejercicios hechos', { exact: true })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Continuar sesión' })).toBeVisible();
});
