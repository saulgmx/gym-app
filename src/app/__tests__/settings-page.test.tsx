import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixedClock, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import { GENERIC_ERROR_MESSAGE } from '../errors/messages';
import type { DeliveryOutcome } from '../pages/settings/deliver';
import {
  closeTestDatabases,
  createTestServices,
  renderRoute,
  renderRouteWhileLoading,
} from './test-app';

// Spec 007 §6.1, AC-3 to AC-12 and §8 decision 16: the Ajustes page and "Descargar respaldo".
// deliverFile is replaced: its share sheet and download are covered in deliver.test.ts (T15).

const deliverFile = vi.hoisted(() =>
  vi.fn<(file: File) => Promise<DeliveryOutcome>>(() => Promise.resolve('shared')),
);
vi.mock('../pages/settings/deliver', () => ({ deliverFile }));

const NOW = fixedClock('2026-11-19T22:30:00-06:00');

const BACKUP_TEXT =
  'Tus datos solo están en este teléfono. Descarga un respaldo de vez en cuando y guárdalo en Archivos, iCloud o tu correo.';
const NOTICE_TEXT =
  'Esta app no es un dispositivo médico. Los avisos sobre el dolor lumbar son orientativos y no sustituyen la valoración de tu traumatólogo o fisioterapeuta.';

beforeEach(() => {
  deliverFile.mockReset();
  deliverFile.mockResolvedValue('shared');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

const services = () => createTestServices({ clock: NOW, seedClock: NOW });

async function openSettings(app: AppServices = services()) {
  await renderRoute('/ajustes', app);
  await screen.findByRole('button', { name: 'Descargar respaldo' });
  return { app, user: userEvent.setup() };
}

const downloadButton = () =>
  screen.getByRole('button', { name: /^(Descargar|Preparando) respaldo…?$/ });
const restoreButton = () => screen.getByRole('button', { name: 'Restaurar respaldo' });
const csvButton = () =>
  screen.getByRole('button', { name: /^(Exportar series \(CSV\)|Preparando CSV…)$/ });

/** Taps "Descargar respaldo" and returns the file handed to deliverFile. */
async function download(user: ReturnType<typeof userEvent.setup>): Promise<File> {
  await act(() => user.click(screen.getByRole('button', { name: 'Descargar respaldo' })));
  // exportAll reads IndexedDB, which can outlast the click's act under load.
  await waitFor(() => {
    expect(deliverFile).toHaveBeenCalledTimes(1);
  });
  // And the button settles once deliverFile resolves.
  await waitFor(() => {
    expect(downloadButton()).toBeEnabled();
  });
  const file = deliverFile.mock.calls[0]?.[0];
  if (!file) throw new Error('deliverFile got no file');
  return file;
}

interface Envelope {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  modules: Record<string, { version: number; data: Record<string, unknown[]> }>;
}

const read = async (file: File) => JSON.parse(await file.text()) as Envelope;

describe('SettingsPage', () => {
  it('AC-3: "Respaldo" con su texto y los dos botones, y después "Aviso" (P-1)', async () => {
    await openSettings();

    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Respaldo', 'Aviso']);

    const backup = screen.getByRole('region', { name: 'Respaldo' });
    expect(within(backup).getByText(BACKUP_TEXT)).toBeInTheDocument();
    expect(
      within(backup)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Descargar respaldo', 'Restaurar respaldo', 'Exportar series (CSV)']); // + spec 008

    const notice = screen.getByRole('region', { name: 'Aviso' });
    expect(within(notice).getByText(NOTICE_TEXT)).toBeInTheDocument();
  });

  it('decisión 16 (a): mientras la base no está lista, el texto y el aviso salen y los botones no', () => {
    const app = { ...services(), ready: new Promise<void>(() => undefined) };
    renderRouteWhileLoading('/ajustes', app);

    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument();
    expect(screen.getByText(BACKUP_TEXT)).toBeInTheDocument();
    expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Descargar respaldo', () => {
  it('AC-4, AC-5: entrega gym-respaldo-2026-11-19.json de tipo application/json', async () => {
    const { user } = await openSettings();
    const file = await download(user);

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('gym-respaldo-2026-11-19.json');
    expect(file.type).toBe('application/json');
  });

  it('AC-7: el sobre con app, schemaVersion, exportedAt y los tres módulos en versión 1', async () => {
    const { user } = await openSettings();
    const backup = await read(await download(user));

    expect(backup.app).toBe('gym-app');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.exportedAt).toBe('2026-11-19T22:30:00-06:00');
    expect(Object.keys(backup.modules)).toEqual(['plan', 'training', 'health']);
    for (const part of Object.values(backup.modules)) expect(part.version).toBe(1);
  });

  it('AC-10: con una sesión en curso, el workout sale in_progress con sus series', async () => {
    const app = services();
    await app.ready;
    // Thursday 19 is a rest day; Wednesday 18 is Full body B.
    const started = await app.training.startWorkout('2026-11-18' as LocalDate);
    if (!started.ok) throw new Error(started.error.code);
    const { user } = await openSettings(app);

    const { training } = (await read(await download(user))).modules;
    expect(training?.data.workouts).toEqual([
      expect.objectContaining({ id: started.value.id, status: 'in_progress' }),
    ]);
    const sets = training?.data.sets ?? [];
    expect(sets).not.toHaveLength(0);
    for (const set of sets) expect(set).toMatchObject({ workoutId: started.value.id });
  });

  it('AC-12: JSON con sangría de 2 espacios', async () => {
    const { user } = await openSettings();
    const text = await (await download(user)).text();

    // With a final newline, as text files end (data service, T12).
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
    expect(text.split('\n')[1]).toBe('  "app": "gym-app",');
  });

  it('decisión 16 (b): "Preparando respaldo…" y desactivado hasta que termina la entrega', async () => {
    let finish!: (outcome: DeliveryOutcome) => void;
    deliverFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = await openSettings();

    await act(() => user.click(screen.getByRole('button', { name: 'Descargar respaldo' })));
    expect(downloadButton()).toHaveTextContent('Preparando respaldo…');
    expect(downloadButton()).toBeDisabled();
    // Still preparing while the sheet is open, not only while exportAll runs.
    await waitFor(() => {
      expect(deliverFile).toHaveBeenCalledTimes(1);
    });
    expect(downloadButton()).toHaveTextContent('Preparando respaldo…');
    expect(downloadButton()).toBeDisabled();

    act(() => {
      finish('downloaded');
    });
    await waitFor(() => {
      expect(downloadButton()).toHaveTextContent('Descargar respaldo');
    });
    expect(downloadButton()).toBeEnabled();
  });

  it('AC-6, decisión 16 (b): cerrar la hoja de compartir no muestra nada', async () => {
    deliverFile.mockResolvedValue('cancelled');
    const { user } = await openSettings();
    await download(user);

    expect(downloadButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeEmptyDOMElement();
  });

  it('decisión 16 (c): si exportar falla, el botón vuelve y sale el texto genérico en la sección', async () => {
    const app = services();
    vi.spyOn(app.data, 'exportAll').mockRejectedValue(new Error('disk failure'));
    const { user } = await openSettings(app);

    await act(() => user.click(screen.getByRole('button', { name: 'Descargar respaldo' })));

    const backup = screen.getByRole('region', { name: 'Respaldo' });
    expect(await within(backup).findByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(deliverFile).not.toHaveBeenCalled();
    expect(downloadButton()).toHaveTextContent('Descargar respaldo');
    expect(downloadButton()).toBeEnabled();
  });

  it('decisión 16 (c): descargar otra vez borra el mensaje anterior (§6.3)', async () => {
    const app = services();
    vi.spyOn(app.data, 'exportAll').mockRejectedValueOnce(new Error('disk failure'));
    const { user } = await openSettings(app);
    await act(() => user.click(screen.getByRole('button', { name: 'Descargar respaldo' })));
    await screen.findByRole('alert');

    await act(() => user.click(screen.getByRole('button', { name: 'Descargar respaldo' })));

    // The message goes as soon as the tap lands, before the new export finishes.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(deliverFile).toHaveBeenCalledTimes(1);
    });
  });
});

// Spec 008 §4.1 (AC-1 to AC-7), §6 and plan §6.6: "Exportar series (CSV)". The file's content is
// covered in series-csv.test.ts; here, what the page hands to deliverFile and its states.

const CSV_TEXT = 'Para abrir tus series en una hoja de cálculo.';
const CSV_HEADER =
  'date,week,session,exercise,metric,setNumber,weightKg,reps,rir,isExtra,completedAt';

/** True when `later` comes after `earlier` in the document. */
const follows = (earlier: Node, later: Node) =>
  (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** Taps "Exportar series (CSV)" and returns the file handed to deliverFile. */
async function exportCsv(user: ReturnType<typeof userEvent.setup>): Promise<File> {
  await act(() => user.click(screen.getByRole('button', { name: 'Exportar series (CSV)' })));
  await waitFor(() => {
    expect(deliverFile).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => {
    expect(csvButton()).toBeEnabled();
  });
  const file = deliverFile.mock.calls[0]?.[0];
  if (!file) throw new Error('deliverFile got no file');
  return file;
}

describe('Exportar series (CSV) (spec 008)', () => {
  it('AC-1: debajo de "Restaurar respaldo", el texto y el botón secundario; la zona de mensajes al final', async () => {
    await openSettings();
    const backup = screen.getByRole('region', { name: 'Respaldo' });

    const text = within(backup).getByText(CSV_TEXT);
    const csv = within(backup).getByRole('button', { name: 'Exportar series (CSV)' });
    const status = within(backup).getByRole('status');
    expect(follows(restoreButton(), text)).toBe(true);
    expect(follows(text, csv)).toBe(true);
    expect(follows(csv, status)).toBe(true);
    // Secondary, as "Restaurar respaldo" (full width and ≥ 44 px come from that class).
    expect(csv.className).toBe(restoreButton().className);
  });

  it('AC-2, AC-3: entrega gym-series-v1-2026-11-19.csv de tipo text/csv, con el BOM y los encabezados', async () => {
    const { user } = await openSettings();
    const file = await exportCsv(user);

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('gym-series-v1-2026-11-19.csv');
    expect(file.type).toBe('text/csv');
    // No sessions yet: only the header (AC-23). ignoreBOM keeps the BOM in the text.
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await file.arrayBuffer());
    expect(text).toBe(`\uFEFF${CSV_HEADER}\r\n`);
  });

  it('AC-4: cerrar la hoja de compartir no muestra nada', async () => {
    deliverFile.mockResolvedValue('cancelled');
    const { user } = await openSettings();
    await exportCsv(user);

    expect(csvButton()).toHaveTextContent('Exportar series (CSV)');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeEmptyDOMElement();
  });

  it('AC-5: "Preparando CSV…" y los tres botones desactivados hasta que termina la entrega', async () => {
    let finish!: (outcome: DeliveryOutcome) => void;
    deliverFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = await openSettings();

    await act(() => user.click(csvButton()));
    expect(csvButton()).toHaveTextContent('Preparando CSV…');
    // Still preparing while the sheet is open, not only while exportSeriesCsv runs.
    await waitFor(() => {
      expect(deliverFile).toHaveBeenCalledTimes(1);
    });
    expect(csvButton()).toHaveTextContent('Preparando CSV…');
    expect(csvButton()).toBeDisabled();
    expect(downloadButton()).toBeDisabled();
    expect(restoreButton()).toBeDisabled();

    act(() => {
      finish('shared');
    });
    await waitFor(() => {
      expect(csvButton()).toHaveTextContent('Exportar series (CSV)');
    });
    expect(csvButton()).toBeEnabled();
    expect(downloadButton()).toBeEnabled();
    expect(restoreButton()).toBeEnabled();
  });

  it('AC-5: mientras se prepara un respaldo, "Exportar series (CSV)" está desactivado', async () => {
    deliverFile.mockImplementation(() => new Promise(() => undefined));
    const { user } = await openSettings();

    await act(() => user.click(downloadButton()));
    expect(csvButton()).toBeDisabled();

    // Also while the sheet is open. Waiting here keeps the late exportAll from reaching the next
    // test's deliverFile.
    await waitFor(() => {
      expect(deliverFile).toHaveBeenCalledTimes(1);
    });
    expect(csvButton()).toBeDisabled();
  });

  it('AC-6: si exportar falla, el botón vuelve y sale el texto genérico al final de la sección', async () => {
    const app = services();
    vi.spyOn(app.data, 'exportSeriesCsv').mockRejectedValue(new Error('disk failure'));
    const { user } = await openSettings(app);

    await act(() => user.click(csvButton()));

    const backup = screen.getByRole('region', { name: 'Respaldo' });
    const alert = await within(backup).findByRole('alert');
    expect(alert).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(follows(csvButton(), alert)).toBe(true);
    expect(deliverFile).not.toHaveBeenCalled();
    expect(csvButton()).toHaveTextContent('Exportar series (CSV)');
    expect(csvButton()).toBeEnabled();
  });

  it('AC-7: exportar borra el error anterior', async () => {
    const app = services();
    vi.spyOn(app.data, 'exportAll').mockRejectedValueOnce(new Error('disk failure'));
    const { user } = await openSettings(app);
    await act(() => user.click(downloadButton()));
    await screen.findByRole('alert');

    await act(() => user.click(csvButton()));

    // The message goes as soon as the tap lands, before the export finishes.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(deliverFile).toHaveBeenCalledTimes(1);
    });
  });
});
