import { act, screen, within } from '@testing-library/react';
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

const downloadButton = () => screen.getByRole('button', { name: /respaldo…?$/ });

/** Taps "Descargar respaldo" and returns the file handed to deliverFile. */
async function download(user: ReturnType<typeof userEvent.setup>): Promise<File> {
  await act(() => user.click(screen.getByRole('button', { name: 'Descargar respaldo' })));
  expect(deliverFile).toHaveBeenCalledTimes(1);
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
    ).toEqual(['Descargar respaldo', 'Restaurar respaldo']);

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
    expect(training?.data.sets).not.toHaveLength(0);
    expect(training?.data.sets).toEqual(
      training?.data.sets?.map(() => expect.objectContaining({ workoutId: started.value.id })),
    );
  });

  it('AC-12: JSON con sangría de 2 espacios', async () => {
    const { user } = await openSettings();
    const text = await (await download(user)).text();

    expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2));
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

    await act(async () => {
      finish('downloaded');
      await Promise.resolve();
    });
    expect(downloadButton()).toHaveTextContent('Descargar respaldo');
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

    expect(deliverFile).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
