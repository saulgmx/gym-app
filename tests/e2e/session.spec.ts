import { expect, test, type Page } from '@playwright/test';
import {
  freezeClockAt,
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
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
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
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(SESSION_URL); // replace: no way back into the discarded one
});

test('AC-2: dos pestañas que inician a la vez quedan en la misma sesión', async ({ context }) => {
  const [first, second] = [await context.newPage(), await context.newPage()];
  for (const page of [first, second]) {
    await freezeClockAt(page, MONDAY);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  }

  await Promise.all(
    [first, second].map((page) => page.getByRole('button', { name: 'Iniciar sesión' }).click()),
  );

  await expect(first).toHaveURL(SESSION_URL);
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
