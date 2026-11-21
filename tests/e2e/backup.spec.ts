import { readFile } from 'node:fs/promises';
import { devices, expect, test, type Browser, type Download, type Page } from '@playwright/test';
import {
  chooseBackup,
  closeMondayWithFlags,
  downloadBackup,
  freezeClockAt,
  NOT_A_BACKUP,
  USER_TIME_ZONE,
  waitForControllingWorker,
  withoutShare,
} from './helpers';

// Spec 007 (plan §7, §8 decision 18) on the production build: download a backup on one device and
// restore it on another, a file that is not a backup, and both without a connection. The share
// sheet is removed, so the backup always downloads (decision 18 (a)).

test.use({ timezoneId: USER_TIME_ZONE });

declare global {
  interface Window {
    cspViolations?: string[];
  }
}

/** Records CSP violations from before any page script (as csp.spec.ts). */
async function recordCspViolations(page: Page) {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations?.push(`${event.violatedDirective}: ${event.blockedURI}`);
    });
  });
}

const cspViolations = (page: Page) => page.evaluate(() => window.cspViolations);

/** A second phone: a new context (its own IndexedDB) with the project's device. */
async function newPhone(browser: Browser, origin: string) {
  // The same devices as the projects in playwright.config.ts.
  const device = test.info().project.name === 'webkit' ? devices['iPhone 13'] : devices['Pixel 7'];
  const context = await browser.newContext({
    ...device,
    baseURL: origin,
    timezoneId: USER_TIME_ZONE,
  });
  return { context, page: await context.newPage() };
}

const goToSettings = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Ajustes' })
    .click();

const backupSection = (page: Page) => page.getByRole('region', { name: 'Respaldo' });
const preview = (page: Page) => page.getByRole('dialog', { name: '¿Restaurar este respaldo?' });

interface Backup {
  app: string;
  modules: { training: { data: { workouts: { status: string }[] } } };
}

test.describe('spec 007: el respaldo', () => {
  test('AC-1 a AC-5, AC-14, AC-18, AC-22 a AC-25, AC-44: descargar en un teléfono y restaurar en otro', async ({
    page,
    browser,
  }) => {
    await withoutShare(page);
    await recordCspViolations(page);
    await closeMondayWithFlags(page); // Monday 16 at 18:00, Full body A with one set, pain 5

    await goToSettings(page);
    await expect(page).toHaveURL('/ajustes');
    await expect(page).toHaveTitle('Ajustes · Gym');
    const download = await downloadBackup(page);
    expect(download.suggestedFilename()).toBe('gym-respaldo-2026-11-16.json');
    const path = await download.path();
    const backup = JSON.parse(await readFile(path, 'utf8')) as Backup;
    expect(backup.app).toBe('gym-app');
    expect(backup.modules.training.data.workouts.map((w) => w.status)).toEqual(['completed']);
    await expect(backupSection(page).getByRole('alert')).toHaveCount(0);
    expect(await cspViolations(page)).toEqual([]);

    // A new phone first opened on Monday 30: its program starts that week.
    const other = await newPhone(browser, new URL(page.url()).origin);
    await recordCspViolations(other.page);
    await freezeClockAt(other.page, '2026-11-30T09:00:00-06:00');
    await other.page.goto('/');
    await expect(other.page.getByText('Semana 1 de 15', { exact: true })).toBeVisible();
    await goToSettings(other.page);

    await chooseBackup(other.page, path);
    const dialog = preview(other.page);
    await expect(dialog).toBeVisible();
    for (const line of [
      'Respaldo del 16 de noviembre de 2026, 18:00',
      '1 sesión · 1 serie · 1 registro de dolor',
      'El 16 de noviembre de 2026',
      'Plan: empieza el lunes 16 de noviembre de 2026',
      'Se reemplazarán el plan y los datos de este dispositivo. No se puede deshacer.',
    ]) {
      await expect(dialog.getByText(line, { exact: true })).toBeVisible();
    }
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Reemplazar mis datos' }).click();

    await expect(backupSection(other.page).getByRole('status')).toHaveText('Respaldo restaurado.');
    await expect(dialog).toBeHidden();
    await expect(other.page).toHaveURL('/ajustes'); // decision 12: it stays
    expect(await cspViolations(other.page)).toEqual([]);

    // AC-23: the history and "Hoy" read the restored data without reloading.
    await other.page.getByRole('link', { name: 'Historial' }).click();
    await expect(
      other.page.getByRole('region', { name: 'Semana 1' }).getByRole('link'),
    ).toHaveCount(1);
    await expect(other.page.getByRole('link', { name: /Lun 16 · Full body A/ })).toBeVisible();
    await other.page.getByRole('link', { name: 'Hoy' }).click();
    // AC-25: the program of the file started on the 16th, so Monday 30 is week 3.
    await expect(other.page.getByText('Semana 3 de 15', { exact: true })).toBeVisible();

    // AC-24: after reloading the restored data is still there.
    await other.page.reload();
    await expect(other.page.getByText('Semana 3 de 15', { exact: true })).toBeVisible();
    await other.context.close();
  });

  test('AC-30: un archivo que no es un respaldo muestra su mensaje y no abre la vista previa', async ({
    page,
  }) => {
    await freezeClockAt(page, '2026-11-16T08:00:00-06:00');
    await page.goto('/ajustes');

    await chooseBackup(page, NOT_A_BACKUP);

    await expect(backupSection(page).getByRole('alert')).toHaveText(
      'Este archivo no es un respaldo de Gym.',
    );
    await expect(preview(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Restaurar respaldo' })).toBeEnabled();
  });

  test('AC-41: sin conexión, se descarga y se restaura igual', async ({ page, context }) => {
    await withoutShare(page);
    await closeMondayWithFlags(page, async () => {
      await waitForControllingWorker(page);
      await context.setOffline(true);
    });

    await goToSettings(page);
    const download = await downloadBackup(page);
    await chooseBackup(page, await download.path());
    const dialog = preview(page);
    await expect(
      dialog.getByText(
        'Se reemplazarán todos los datos de este dispositivo: 1 sesión guardada, el plan y el dolor lumbar. No se puede deshacer.',
      ),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Reemplazar mis datos' }).click();

    await expect(backupSection(page).getByRole('status')).toHaveText('Respaldo restaurado.');
    await page.getByRole('link', { name: 'Historial' }).click();
    await expect(page.getByRole('link', { name: /Lun 16 · Full body A/ })).toBeVisible();
  });
});

// Spec 008 (plan §7, T13) on the production build: "Exportar series (CSV)" downloads the file with
// the BOM, the header and one row per done set, also offline, with no CSP violations. The share
// sheet is removed, so the file always downloads (AC-3). The full content is covered with the real
// modules in src/app/__tests__/series-csv.test.ts.

const CSV_HEADER =
  'date,week,session,exercise,metric,setNumber,weightKg,reps,rir,isExtra,completedAt';
// closeMondayWithFlags: the first set of Full body A, done on Monday 16 at 18:00 (frozen clock).
const MONDAY_SET =
  '2026-11-16,1,Full body A,Prensa de piernas,weight,1,40,10,3,false,2026-11-16T18:00:00-06:00';

/** Taps "Exportar series (CSV)" on Ajustes and returns the download, saved to disk. */
async function exportCsv(page: Page): Promise<Download> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar series (CSV)' }).click(),
  ]);
  await download.path(); // waits until the file is complete
  return download;
}

/** The downloaded CSV: its name and its lines, after checking the BOM and the CRLF ending. */
async function readCsv(download: Download) {
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // RN-DAT-14: UTF-8 BOM
  const text = bytes.subarray(3).toString('utf8');
  expect(text.endsWith('\r\n')).toBe(true); // CRLF also after the last line
  return { name: download.suggestedFilename(), lines: text.slice(0, -2).split('\r\n') };
}

test.describe('spec 008: el CSV de series', () => {
  test('AC-1, AC-3, AC-30: con una sesión cerrada, descarga el CSV con sus series y sin violaciones de CSP', async ({
    page,
  }) => {
    await withoutShare(page);
    await recordCspViolations(page);
    await closeMondayWithFlags(page);

    await goToSettings(page);
    await expect(
      backupSection(page).getByText('Para abrir tus series en una hoja de cálculo.'),
    ).toBeVisible();
    const csv = await readCsv(await exportCsv(page));

    expect(csv.name).toBe('gym-series-v1-2026-11-16.csv');
    expect(csv.lines).toEqual([CSV_HEADER, MONDAY_SET]);
    await expect(page.getByRole('button', { name: 'Exportar series (CSV)' })).toBeEnabled();
    await expect(backupSection(page).getByRole('alert')).toHaveCount(0);
    expect(await cspViolations(page)).toEqual([]);
  });

  test('AC-28: sin conexión, se descarga igual', async ({ page, context }) => {
    await withoutShare(page);
    await closeMondayWithFlags(page, async () => {
      await waitForControllingWorker(page);
      await context.setOffline(true);
    });

    await goToSettings(page);
    const csv = await readCsv(await exportCsv(page));

    expect(csv.name).toBe('gym-series-v1-2026-11-16.csv');
    expect(csv.lines).toEqual([CSV_HEADER, MONDAY_SET]);
  });
});
