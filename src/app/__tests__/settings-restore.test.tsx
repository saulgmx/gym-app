import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingImport } from '@/modules/data';
import { fixedClock, ok, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import { GENERIC_ERROR_MESSAGE } from '../errors/messages';
import type { DeliveryOutcome } from '../pages/settings/deliver';
import {
  closeTestDatabases,
  createTestServices,
  lastTestDatabase,
  renderRoute,
  tapToNavigate,
} from './test-app';
import { deviceWithSpecData, dump, exportText } from './test-backup';
import { closeSession, setup } from './test-sessions';

// Spec 007 §6.2, §6.3, AC-13 to AC-39 and §8 decision 17: "Restaurar respaldo" on the Ajustes
// page, with the real compose and files exported from a database built through the API.

const deliverFile = vi.hoisted(() =>
  vi.fn<(file: File) => Promise<DeliveryOutcome>>(() => Promise.resolve('shared')),
);
vi.mock('../pages/settings/deliver', () => ({ deliverFile }));

const NOW = fixedClock('2026-11-19T22:30:00-06:00');
const date = (s: string) => s as LocalDate;

const TEXTS = {
  restored: 'Respaldo restaurado.',
  tooLarge: 'El archivo es demasiado grande para ser un respaldo de Gym.',
  notGym: 'Este archivo no es un respaldo de Gym.',
  newer: 'Este respaldo es de una versión más nueva de la app. Actualízala e inténtalo de nuevo.',
  damaged: 'El respaldo está dañado o incompleto. No se cambió nada.',
  highRisk:
    'Este respaldo incluye un ejercicio que la app no permite por tu espalda. No se cambió nada.',
  inProgress: 'Tienes una sesión en curso. Termínala o descártala antes de restaurar un respaldo.',
};

/** The sample file of spec §4, exported on Thursday 19 at 22:30 (built once: it is a string). */
let sample: string;

beforeAll(async () => {
  const source = await deviceWithSpecData();
  source.time.set('2026-11-19T22:30:00-06:00');
  sample = await exportText(source.services);
  await closeTestDatabases();
});

beforeEach(() => {
  vi.stubEnv('TZ', 'America/Mexico_City');
  deliverFile.mockReset();
  deliverFile.mockResolvedValue('shared');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await closeTestDatabases();
});

interface Backup {
  app: string;
  schemaVersion: number;
  modules: Record<string, { version: number; data: Record<string, Record<string, unknown>[]> }>;
}

/** The sample file with a change. */
function edited(change: (backup: Backup) => void): string {
  const backup = JSON.parse(sample) as Backup;
  change(backup);
  return JSON.stringify(backup, null, 2);
}

const fileOf = (text: string | Uint8Array<ArrayBuffer>) =>
  new File([text], 'gym-respaldo-2026-11-19.json', { type: 'application/json' });

/** A device with no sessions, seeded this week. */
const emptyDevice = () => createTestServices({ clock: NOW, seedClock: NOW });

/** A device with 3 completed sessions: Monday 16, Wednesday 18 and Friday 20 (AC-14). */
async function deviceWithThreeSessions() {
  const env = await setup();
  await closeSession(env, { on: '2026-11-16', allSets: true });
  await closeSession(env, { on: '2026-11-18', allSets: true });
  await closeSession(env, { on: '2026-11-20', allSets: true });
  return env.services;
}

async function openSettings(app: AppServices) {
  await renderRoute('/ajustes', app);
  await screen.findByRole('button', { name: 'Restaurar respaldo' });
  return userEvent.setup();
}

const fileInput = () => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('no file input');
  return input;
};
const restoreButton = () =>
  screen.getByRole('button', { name: /^(Restaurar respaldo|Revisando…)$/ });
const downloadButton = () =>
  screen.getByRole('button', { name: /^(Descargar|Preparando) respaldo…?$/ });
const previewDialog = () => screen.queryByRole('dialog', { name: '¿Restaurar este respaldo?' });
const section = () => screen.getByRole('region', { name: 'Respaldo' });

/** The status region is always mounted (to be announced), so wait for its text. */
const restoredShown = () =>
  waitFor(() => {
    expect(within(section()).getByRole('status')).toHaveTextContent(TEXTS.restored);
  });

/** Taps "Restaurar respaldo" and picks a file, as the system picker would. */
async function choose(user: ReturnType<typeof userEvent.setup>, file: File) {
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementationOnce(() => undefined);
  await act(() => user.click(restoreButton()));
  await act(() => user.upload(fileInput(), file));
}

/** Picks a file and waits for the preview. */
async function preview(user: ReturnType<typeof userEvent.setup>, text = sample) {
  await choose(user, fileOf(text));
  return screen.findByRole('dialog', { name: '¿Restaurar este respaldo?' });
}

/** Picks a file and waits for its rejection message. */
async function rejected(user: ReturnType<typeof userEvent.setup>, file: File) {
  await choose(user, file);
  return within(section()).findByRole('alert');
}

/** previewImport as the real one, but commit waits until `release` (AC-22 "Restaurando…"). */
function holdCommit(
  app: AppServices,
  wrap?: (commit: PendingImport['commit']) => PendingImport['commit'],
) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const real = app.data.previewImport.bind(app.data);
  vi.spyOn(app.data, 'previewImport').mockImplementation(async (file) => {
    const result = await real(file);
    if (!result.ok) return result;
    const commit = wrap ? wrap(result.value.commit) : result.value.commit;
    return ok({
      preview: result.value.preview,
      commit: async () => {
        await gate;
        return commit();
      },
    });
  });
  return () => {
    act(() => {
      release();
    });
  };
}

// RN-DAT-08: the same content but exportedAt.
const contentOf = (text: string): unknown => {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  delete parsed.exportedAt;
  return parsed;
};

describe('Restaurar respaldo: elegir el archivo', () => {
  it('AC-13: el botón abre un input de archivo oculto que acepta .json', async () => {
    const user = await openSettings(emptyDevice());
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);

    await act(() => user.click(restoreButton()));

    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.contexts[0]).toBe(fileInput());
    expect(fileInput()).toHaveAttribute('accept', 'application/json,.json');
    expect(fileInput()).not.toBeVisible();
  });

  it('decisión 17 (b): cerrar el selector sin elegir archivo no hace nada', async () => {
    const app = emptyDevice();
    await openSettings(app);
    const review = vi.spyOn(app.data, 'previewImport');

    // A `change` with no file, as some browsers send on cancel (user.upload([]) sends nothing).
    act(() => {
      fireEvent.change(fileInput(), { target: { files: [] } });
    });

    expect(review).not.toHaveBeenCalled();
    expect(restoreButton()).toHaveTextContent('Restaurar respaldo');
    expect(restoreButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(previewDialog()).not.toBeInTheDocument();
  });

  it('AC-20, decisión 17 (a): "Revisando…" y los dos botones desactivados mientras se revisa', async () => {
    const app = emptyDevice();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const real = app.data.previewImport.bind(app.data);
    vi.spyOn(app.data, 'previewImport').mockImplementation(async (file) => {
      await gate;
      return real(file);
    });
    const user = await openSettings(app);

    await choose(user, fileOf(sample));
    expect(restoreButton()).toHaveTextContent('Revisando…');
    expect(restoreButton()).toBeDisabled();
    expect(downloadButton()).toBeDisabled();

    act(() => {
      finish();
    });
    expect(await screen.findByRole('dialog', { name: '¿Restaurar este respaldo?' })).toBeVisible();
  });

  it('decisión 17 (a): mientras se prepara una descarga, "Restaurar respaldo" está desactivado', async () => {
    deliverFile.mockImplementation(() => new Promise(() => undefined));
    const user = await openSettings(emptyDevice());

    await act(() => user.click(downloadButton()));

    expect(restoreButton()).toBeDisabled();
  });

  it('decisión 17 (c): si la revisión falla de forma inesperada, el botón vuelve y sale el texto genérico', async () => {
    const app = emptyDevice();
    vi.spyOn(app.data, 'previewImport').mockRejectedValue(new Error('read failure'));
    const user = await openSettings(app);

    expect(await rejected(user, fileOf(sample))).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(restoreButton()).toHaveTextContent('Restaurar respaldo');
    expect(restoreButton()).toBeEnabled();
    expect(downloadButton()).toBeEnabled();
    expect(fileInput().value).toBe('');
  });
});

describe('Restaurar respaldo: vista previa', () => {
  it('AC-14: el diálogo con la fecha, las cifras, el rango, el plan y lo que se reemplaza', async () => {
    const user = await openSettings(await deviceWithThreeSessions());
    const dialog = await preview(user);

    const lines = [
      'Respaldo del 19 de noviembre de 2026, 22:30',
      '2 sesiones · 15 series · 2 registros de dolor',
      'Del 16 al 18 de noviembre de 2026',
      'Plan: empieza el lunes 16 de noviembre de 2026',
      'Se reemplazarán todos los datos de este dispositivo: 3 sesiones guardadas, el plan y el dolor lumbar. No se puede deshacer.',
    ];
    for (const line of lines) expect(within(dialog).getByText(line)).toBeInTheDocument();
    const text = dialog.textContent;
    expect(lines.map((line) => text.indexOf(line))).toEqual(
      lines.map((line) => text.indexOf(line)).sort((a, b) => a - b),
    );
    expect(within(dialog).queryByText('Incluye una sesión en curso.')).not.toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cancelar', 'Reemplazar mis datos']);
  });

  it('plan §6.8: el foco entra en "Cancelar"', async () => {
    const user = await openSettings(emptyDevice());
    const dialog = await preview(user);
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('AC-16: un archivo sin sesiones guardadas dice "Sin sesiones guardadas" y no muestra rango', async () => {
    const empty = emptyDevice();
    await empty.ready;
    const text = await exportText(empty);
    const user = await openSettings(emptyDevice());

    const dialog = await preview(user, text);

    // Every line of the dialog: no figures and no range at all.
    expect([...dialog.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Respaldo del 19 de noviembre de 2026, 22:30',
      'Sin sesiones guardadas',
      'Plan: empieza el lunes 16 de noviembre de 2026',
      'Se reemplazarán el plan y los datos de este dispositivo. No se puede deshacer.',
    ]);
  });

  it('AC-17: un archivo con una sesión en curso lo dice', async () => {
    const source = emptyDevice();
    await source.ready;
    const started = await source.training.startWorkout(date('2026-11-18'));
    if (!started.ok) throw new Error(started.error.code);
    const text = await exportText(source);
    const user = await openSettings(emptyDevice());

    const dialog = await preview(user, text);

    expect(within(dialog).getByText('Incluye una sesión en curso.')).toBeInTheDocument();
  });

  it('AC-18: sin sesiones en el dispositivo, el texto destacado no las cuenta', async () => {
    const user = await openSettings(emptyDevice());
    const dialog = await preview(user);
    expect(
      within(dialog).getByText(
        'Se reemplazarán el plan y los datos de este dispositivo. No se puede deshacer.',
      ),
    ).toBeInTheDocument();
  });

  it('AC-19, decisión 17 (f): "Cancelar" cierra sin cambiar nada y el foco vuelve a "Restaurar respaldo"', async () => {
    const app = emptyDevice();
    const user = await openSettings(app);
    const before = await dump(lastTestDatabase());
    const dialog = await preview(user);

    await act(() => user.click(within(dialog).getByRole('button', { name: 'Cancelar' })));

    expect(previewDialog()).not.toBeInTheDocument();
    expect(await dump(lastTestDatabase())).toStrictEqual(before);
    expect(restoreButton()).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('AC-19: Escape también cierra sin cambiar nada', async () => {
    const app = emptyDevice();
    const user = await openSettings(app);
    const before = await dump(lastTestDatabase());
    const dialog = await preview(user);

    act(() => {
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
    });

    expect(previewDialog()).not.toBeInTheDocument();
    expect(await dump(lastTestDatabase())).toStrictEqual(before);
    expect(restoreButton()).toHaveFocus();
  });

  it('AC-21: el mismo archivo dos veces seguidas se revisa otra vez (el input se limpia)', async () => {
    const app = emptyDevice();
    const review = vi.spyOn(app.data, 'previewImport');
    const user = await openSettings(app);
    const file = fileOf(sample);

    await choose(user, file);
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar este respaldo?' });
    expect(fileInput().value).toBe('');
    await act(() => user.click(within(dialog).getByRole('button', { name: 'Cancelar' })));

    await choose(user, file);

    expect(await screen.findByRole('dialog', { name: '¿Restaurar este respaldo?' })).toBeVisible();
    expect(review).toHaveBeenCalledTimes(2);
  });
});

describe('Restaurar respaldo: confirmar', () => {
  it('AC-22, decisión 17 (f): reemplaza todo, cierra el diálogo, "Respaldo restaurado." y el foco vuelve', async () => {
    const app = await deviceWithThreeSessions();
    const release = holdCommit(app);
    const user = await openSettings(app);
    const dialog = await preview(user);

    await act(() =>
      user.click(within(dialog).getByRole('button', { name: 'Reemplazar mis datos' })),
    );

    const replace = within(dialog).getByRole('button', { name: 'Restaurando…' });
    expect(replace).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(downloadButton()).toBeDisabled();
    expect(restoreButton()).toBeDisabled();

    release();

    await restoredShown();
    expect(previewDialog()).not.toBeInTheDocument();
    expect(restoreButton()).toHaveFocus();
    expect(downloadButton()).toBeEnabled();
    expect(contentOf(await exportText(app))).toStrictEqual(contentOf(sample));
  });

  it('plan §6.8: mientras restaura, Escape no cierra el diálogo', async () => {
    const app = emptyDevice();
    const release = holdCommit(app);
    const user = await openSettings(app);
    const dialog = await preview(user);
    await act(() =>
      user.click(within(dialog).getByRole('button', { name: 'Reemplazar mis datos' })),
    );

    act(() => {
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
    });

    expect(previewDialog()).toBeInTheDocument();
    release();
    await restoredShown();
  });

  it('AC-23: tras restaurar, "Historial" muestra las sesiones del archivo sin recargar', async () => {
    const user = await openSettings(emptyDevice());
    const dialog = await preview(user);
    await act(() =>
      user.click(within(dialog).getByRole('button', { name: 'Reemplazar mis datos' })),
    );
    await restoredShown();

    await tapToNavigate(user, screen.getByRole('link', { name: 'Historial' }));

    const rows = await screen.findAllByRole('link', { name: /Full body A/ });
    expect(rows).toHaveLength(2);
  });

  it('AC-28, decisión 17 (d): una sesión empezada después de la vista previa cierra el diálogo con su mensaje', async () => {
    const app = emptyDevice();
    const user = await openSettings(app);
    const dialog = await preview(user);
    const started = await app.training.startWorkout(date('2026-11-18'));
    if (!started.ok) throw new Error(started.error.code);
    const before = await dump(lastTestDatabase());

    await act(() =>
      user.click(within(dialog).getByRole('button', { name: 'Reemplazar mis datos' })),
    );

    expect(await within(section()).findByRole('alert')).toHaveTextContent(TEXTS.inProgress);
    expect(previewDialog()).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(await dump(lastTestDatabase())).toStrictEqual(before);
    expect(restoreButton()).toHaveFocus();
  });

  it('AC-27, decisión 17 (d): si la escritura falla, el diálogo se cierra con el texto genérico y nada cambia', async () => {
    const app = emptyDevice();
    const release = holdCommit(app, () => () => Promise.reject(new Error('disk failure')));
    const user = await openSettings(app);
    const before = await dump(lastTestDatabase());
    const dialog = await preview(user);

    await act(() =>
      user.click(within(dialog).getByRole('button', { name: 'Reemplazar mis datos' })),
    );
    release();

    expect(await within(section()).findByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(previewDialog()).not.toBeInTheDocument();
    expect(await dump(lastTestDatabase())).toStrictEqual(before);
    expect(restoreButton()).toBeEnabled();
  });
});

describe('Restaurar respaldo: archivos rechazados (§6.3)', () => {
  it('AC-29: un archivo de más de 10 MB', async () => {
    const user = await openSettings(emptyDevice());
    const big = fileOf(new Uint8Array(10 * 1024 * 1024 + 1));
    expect(await rejected(user, big)).toHaveTextContent(TEXTS.tooLarge);
  });

  it.each([
    ['AC-30: no es JSON', () => 'no es json', TEXTS.notGym],
    ['AC-30: JSON de otra app', () => edited((b) => (b.app = 'otra-app')), TEXTS.notGym],
    ['AC-31: schemaVersion 2', () => edited((b) => (b.schemaVersion = 2)), TEXTS.newer],
    [
      'AC-31: un módulo en versión 2',
      () =>
        edited((b) => {
          const training = b.modules.training;
          if (training) training.version = 2;
        }),
      TEXTS.newer,
    ],
    [
      'AC-32: un nivel de dolor de 11',
      () =>
        edited((b) => {
          const entry = b.modules.health?.data.painEntries?.[0];
          if (entry) entry.level = 11;
        }),
      TEXTS.damaged,
    ],
    [
      'AC-32: una clave desconocida',
      () =>
        edited((b) => {
          const workout = b.modules.training?.data.workouts?.[0];
          if (workout) workout.extra = 1;
        }),
      TEXTS.damaged,
    ],
    ['AC-32: falta un módulo', () => edited((b) => delete b.modules.health), TEXTS.damaged],
    [
      'AC-32: sobra un módulo',
      () => edited((b) => (b.modules.progression = { version: 1, data: {} })),
      TEXTS.damaged,
    ],
    [
      'AC-34: un ejercicio de riesgo alto (P-1)',
      () =>
        edited((b) => {
          const exercise = b.modules.plan?.data.exercises?.[0];
          if (exercise) exercise.lumbarRisk = 'high';
        }),
      TEXTS.highRisk,
    ],
    [
      'AC-35, decisión 17 (e): bloques con huecos, otra causa del plan',
      () => edited((b) => b.modules.plan?.data.blocks?.splice(1, 1)),
      TEXTS.damaged,
    ],
    [
      'AC-36: una serie de un workout que no está',
      () =>
        edited((b) => {
          const set = b.modules.training?.data.sets?.[0];
          if (set) set.workoutId = '0196a000-0000-7000-8000-999999999999';
        }),
      TEXTS.damaged,
    ],
    [
      'AC-37: dos entradas de dolor para el mismo workout',
      () =>
        edited((b) => {
          const entries = b.modules.health?.data.painEntries;
          const first = entries?.[0];
          if (first) entries.push({ ...first, id: '0196a000-0000-7000-8000-999999999998' });
        }),
      TEXTS.damaged,
    ],
  ])('%s', async (_, text, message) => {
    const app = emptyDevice();
    const user = await openSettings(app);
    const before = await dump(lastTestDatabase());

    expect(await rejected(user, fileOf(text()))).toHaveTextContent(message);
    expect(previewDialog()).not.toBeInTheDocument();
    expect(await dump(lastTestDatabase())).toStrictEqual(before);
  });

  it('AC-33: con una sesión en curso en el dispositivo', async () => {
    const app = emptyDevice();
    await app.ready;
    const started = await app.training.startWorkout(date('2026-11-18'));
    if (!started.ok) throw new Error(started.error.code);
    const user = await openSettings(app);

    expect(await rejected(user, fileOf(sample))).toHaveTextContent(TEXTS.inProgress);
  });

  it('§6.3: un mensaje nuevo reemplaza al anterior, y un archivo bueno lo borra', async () => {
    const user = await openSettings(emptyDevice());
    await rejected(user, fileOf('no es json'));
    expect(await rejected(user, fileOf(edited((b) => (b.schemaVersion = 2))))).toHaveTextContent(
      TEXTS.newer,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    await choose(user, fileOf(sample));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await screen.findByRole('dialog', { name: '¿Restaurar este respaldo?' });
  });

  it('§6.3: descargar un respaldo borra "Respaldo restaurado."', async () => {
    const app = emptyDevice();
    const user = await openSettings(app);
    const dialog = await preview(user);
    await act(() =>
      user.click(within(dialog).getByRole('button', { name: 'Reemplazar mis datos' })),
    );
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(TEXTS.restored);
    });

    await act(() => user.click(downloadButton()));

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('Restaurar respaldo: datos tolerados (RN-DAT-12)', () => {
  it.each([
    [
      'AC-38: dos sesiones completed el mismo día',
      () =>
        edited((b) => {
          const workouts = b.modules.training?.data.workouts ?? [];
          const days = workouts.filter((w) => w.status === 'completed');
          const [first, second] = days;
          if (first && second) second.date = first.date;
        }),
    ],
    [
      'AC-39: una sesión completed sin entrada de dolor',
      () => edited((b) => b.modules.health?.data.painEntries?.pop()),
    ],
  ])('%s se acepta y se restaura', async (_, text) => {
    const app = emptyDevice();
    const user = await openSettings(app);
    const dialog = await preview(user, text());

    await act(() =>
      user.click(within(dialog).getByRole('button', { name: 'Reemplazar mis datos' })),
    );

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(TEXTS.restored);
    });
    expect(contentOf(await exportText(app))).toStrictEqual(contentOf(text()));
  });
});
