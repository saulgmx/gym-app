import 'fake-indexeddb/auto';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrainingApi, TrainingError, Workout, WorkoutView } from '@/modules/training';
import { err, fixedClock, type ID, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import {
  closeTestDatabases,
  createTestServices,
  renderRoute,
  renderRouteWhileLoading,
  tapToNavigate,
} from './test-app';

// The active session page (spec 002 AC-4, AC-22 to AC-28, AC-34; plan §6.7) over the real seed.
// Monday 2026-11-16 is Full body A in week 1: Prensa de piernas (2 sets), Press de banca con
// barra (2 sets, alternative Press de banca con mancuernas), ... and Dead bug last (7 exercises).

const MONDAY = '2026-11-16' as LocalDate;

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

async function withWorkout() {
  const services = createTestServices({ clock: fixedClock('2026-11-16T08:00:00-06:00') });
  await services.ready;
  const result = await services.training.startWorkout(MONDAY);
  if (!result.ok) throw new Error(result.error.code);
  return { services, workout: result.value };
}

async function setsOf(training: TrainingApi, workout: Workout, order: number) {
  const view = await training.getWorkoutView(workout.id);
  const exerciseId = workout.items.find((i) => i.order === order)?.exerciseId;
  return view?.sets.filter((s) => s.exerciseId === exerciseId) ?? [];
}

/** Logs and marks a set, as the user would. */
async function done(training: TrainingApi, workout: Workout, order: number, setNumber: number) {
  const set = (await setsOf(training, workout, order)).find((s) => s.setNumber === setNumber);
  if (!set) throw new Error(`No set ${String(setNumber)} in item ${String(order)}`);
  const view = await training.getWorkoutView(workout.id);
  const weighted = view?.exercises[set.exerciseId]?.metric === 'weight';
  await training.logSet(
    set.id,
    weighted ? { weightKg: 60, reps: 10, rir: 3 } : { reps: 10, rir: 3 },
  );
  const marked = await training.toggleSetDone(set.id);
  if (!marked.ok) throw new Error(marked.error.code);
}

async function open(path: string, services: AppServices) {
  const router = await renderRoute(path, services);
  return { router, user: userEvent.setup() };
}

const heading = () => screen.findByRole('heading', { level: 1 });

/** Opens the full card (spec 004 AC-21): the note and "Cambiar a …" live there. */
async function showDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Ver detalles' }));
}

function withTraining(services: AppServices, overrides: Partial<TrainingApi>): AppServices {
  return { ...services, training: { ...services.training, ...overrides } };
}

/** Changes what the page reads for one exercise, for facts the seed does not have. */
function editView(services: AppServices, edit: (view: WorkoutView) => WorkoutView): AppServices {
  const { training } = services;
  return withTraining(services, {
    getWorkoutView: async (id) => {
      const view = await training.getWorkoutView(id);
      return view && edit(view);
    },
  });
}

describe('el ejercicio', () => {
  it('AC-22: encabezado, nombre, series y rango, la nota (en los detalles) y la tabla', async () => {
    const { services, workout } = await withWorkout();
    const { user } = await open(`/sesion/${workout.id}/2`, services);

    expect(await heading()).toHaveTextContent('Press de banca con barra');
    expect(screen.getByRole('button', { name: 'Ejercicio 2 de 7' })).toBeInTheDocument();
    expect(screen.getByText('2 × 6-10 · RIR 3-4')).toBeVisible();
    await showDetails(user);
    expect(screen.getByText('Costillas abajo, sin arco')).toBeVisible();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Serie 2, kilos' })).toBeInTheDocument();
    expect(document.title).toBe('Sesión · Gym');
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();
  });

  it('RF-17: el consejo del ejercicio y la nota de la plantilla, cada uno en su párrafo', async () => {
    const { services, workout } = await withWorkout();
    const prensaId = workout.items[0]?.exerciseId ?? ('' as ID);
    const withCue = editView(services, (view) => {
      const prensa = view.exercises[prensaId];
      if (!prensa) return view;
      return {
        ...view,
        exercises: {
          ...view.exercises,
          [prensaId]: { ...prensa, cue: 'Pies a la anchura de la cadera' },
        },
      };
    });
    const { user } = await open(`/sesion/${workout.id}/1`, withCue);
    await heading();
    await showDetails(user);

    expect(screen.getByText('Pies a la anchura de la cadera').tagName).toBe('P');
    expect(screen.getByText('Pelvis pegada al respaldo, sin despegar la lumbar').tagName).toBe('P');
  });

  it('en un ejercicio de tiempo el rango va en segundos', async () => {
    const { services, workout } = await withWorkout();
    const deadBugId = workout.items[6]?.exerciseId ?? ('' as ID);
    const asTime = editView(services, (view) => {
      const deadBug = view.exercises[deadBugId];
      if (!deadBug) return view;
      return {
        ...view,
        exercises: { ...view.exercises, [deadBugId]: { ...deadBug, metric: 'time' } },
      };
    });
    await open(`/sesion/${workout.id}/7`, asTime);
    await heading();

    expect(screen.getByText(/^\d+ × \d+-\d+ s · RIR 3-4$/)).toBeInTheDocument();
  });
});

describe('Cambiar a …', () => {
  it('AC-23: cambia a la alternativa y ofrece volver', async () => {
    const { services, workout } = await withWorkout();
    const { user } = await open(`/sesion/${workout.id}/2`, services);
    await heading();
    await showDetails(user);

    await user.click(
      screen.getByRole('button', { name: 'Cambiar a Press de banca con mancuernas' }),
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Press de banca con mancuernas',
      );
    });
    expect(
      screen.getByRole('button', { name: 'Cambiar a Press de banca con barra' }),
    ).toBeEnabled();
    const active = await services.training.getActiveWorkout();
    expect(active?.items[1]?.exerciseId).toBe(workout.items[1]?.options[1]);
  });

  it('AC-24: con una serie hecha está deshabilitado y dice por qué', async () => {
    const { services, workout } = await withWorkout();
    await done(services.training, workout, 2, 1);
    const { user } = await open(`/sesion/${workout.id}/2`, services);
    await heading();
    await showDetails(user);

    const change = screen.getByRole('button', { name: 'Cambiar a Press de banca con mancuernas' });
    expect(change).toBeDisabled();
    expect(change).toHaveAccessibleDescription(
      'Para cambiar de ejercicio, desmarca las series hechas',
    );
  });

  it('una serie hecha de otro ejercicio no lo bloquea', async () => {
    const { services, workout } = await withWorkout();
    await done(services.training, workout, 1, 1);
    const { user } = await open(`/sesion/${workout.id}/2`, services);
    await heading();
    await showDetails(user);

    expect(
      screen.getByRole('button', { name: 'Cambiar a Press de banca con mancuernas' }),
    ).toBeEnabled();
    expect(
      screen.queryByText('Para cambiar de ejercicio, desmarca las series hechas'),
    ).not.toBeInTheDocument();
  });

  it('al cambiar, la tabla empieza de cero: sin el borrador ni el error del anterior', async () => {
    const { services, workout } = await withWorkout();
    const { user } = await open(`/sesion/${workout.id}/2`, services);
    await heading();
    await showDetails(user);
    await user.type(screen.getByRole('textbox', { name: 'Serie 1, kilos' }), 'abc');

    // The tap blurs the field first: its draft is rejected, then the exercise changes.
    await user.click(
      screen.getByRole('button', { name: 'Cambiar a Press de banca con mancuernas' }),
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('mancuernas');
    });
    expect(screen.queryByText('Escribe un número.')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Serie 1, kilos' })).toHaveValue('');
  });

  it('sin alternativa no hay control de cambio', async () => {
    const { services, workout } = await withWorkout();
    const { user } = await open(`/sesion/${workout.id}/1`, services);
    await heading();
    await showDetails(user);

    expect(screen.queryByRole('button', { name: /^Cambiar a/ })).not.toBeInTheDocument();
  });

  it('si el cambio falla, muestra el motivo', async () => {
    const { services, workout } = await withWorkout();
    const chooseExercise = () =>
      Promise.resolve(err<TrainingError>({ code: 'training/workout-closed', message: 'closed' }));
    const { user } = await open(
      `/sesion/${workout.id}/2`,
      withTraining(services, { chooseExercise }),
    );
    await heading();
    await showDetails(user);

    await user.click(
      screen.getByRole('button', { name: 'Cambiar a Press de banca con mancuernas' }),
    );

    expect(await screen.findByText('Esta sesión ya terminó y no se puede cambiar.')).toBeVisible();
    // spec 004 §6.4: the message stays in the compact card too.
    await user.click(screen.getByRole('button', { name: 'Ocultar detalles' }));
    expect(screen.getByText('Esta sesión ya terminó y no se puede cambiar.')).toBeVisible();
  });
});

describe('la tarjeta del ejercicio (spec 004 AC-20 a AC-25)', () => {
  const toggle = (name: string) => screen.getByRole('button', { name });

  it('AC-20: empieza compacta: el nombre, la línea y "Ver detalles"; sin nota ni cambio', async () => {
    const { services, workout } = await withWorkout();
    await open(`/sesion/${workout.id}/2`, services);
    await heading();

    expect(screen.getByText('2 × 6-10 · RIR 3-4')).toBeVisible();
    expect(screen.getByText('Costillas abajo, sin arco')).not.toBeVisible();
    expect(screen.queryByRole('button', { name: /^Cambiar a/ })).not.toBeInTheDocument();
    const button = toggle('Ver detalles');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const details = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(details).not.toBeNull();
    expect(details).not.toBeVisible();
  });

  it('AC-21: completa: chips, la nota sin etiqueta y "Cambiar a …"; "Ocultar detalles"', async () => {
    const { services, workout } = await withWorkout();
    const { user } = await open(`/sesion/${workout.id}/2`, services);
    await heading();

    await showDetails(user);

    const chips = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(chips.map((chip) => chip.textContent)).toEqual(['2 series', '6-10 reps', 'RIR 3-4']);
    expect(screen.getByText('Costillas abajo, sin arco')).toBeVisible();
    expect(screen.queryByText(/Nota de la plantilla/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cambiar a Press de banca con mancuernas' }),
    ).toBeVisible();
    expect(toggle('Ocultar detalles')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('2 × 6-10 · RIR 3-4')).not.toBeInTheDocument();
  });

  it('AC-21: un ejercicio de 1 serie dice "1 serie"', async () => {
    const { services, workout } = await withWorkout();
    const { user } = await open(`/sesion/${workout.id}/4`, services);
    await heading();
    await showDetails(user);

    expect(within(screen.getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent(
      /^1 serie$/,
    );
  });

  it('AC-22: la elección se conserva al pasar a otro ejercicio, por "Siguiente" y por el menú', async () => {
    const { services, workout } = await withWorkout();
    const { user } = await open(`/sesion/${workout.id}/2`, services);
    await heading();
    await showDetails(user);

    await tapToNavigate(user, screen.getByRole('link', { name: 'Siguiente' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dominadas');
    });
    expect(toggle('Ocultar detalles')).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle('Ocultar detalles'));
    await user.click(screen.getByRole('button', { name: 'Ejercicio 3 de 7' }));
    await tapToNavigate(
      user,
      within(screen.getByRole('dialog', { name: 'Full body A' })).getByRole('button', {
        name: /^Curl femoral/,
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Curl femoral');
    });
    expect(toggle('Ver detalles')).toHaveAttribute('aria-expanded', 'false');
  });

  it('AC-22: al abrir la página otra vez vuelve a compacta (no se guarda)', async () => {
    const { services, workout } = await withWorkout();
    const first = await open(`/sesion/${workout.id}/2`, services);
    await heading();
    await showDetails(first.user);
    cleanup();

    await open(`/sesion/${workout.id}/2`, services);
    await heading();

    expect(toggle('Ver detalles')).toHaveAttribute('aria-expanded', 'false');
  });

  it('AC-23: por tiempo, la línea y el chip van en segundos', async () => {
    const { services, workout } = await withWorkout();
    const deadBugId = workout.items[6]?.exerciseId ?? ('' as ID);
    const asTime = editView(services, (view) => {
      const deadBug = view.exercises[deadBugId];
      if (!deadBug) return view;
      return {
        ...view,
        exercises: { ...view.exercises, [deadBugId]: { ...deadBug, metric: 'time' } },
      };
    });
    const { user } = await open(`/sesion/${workout.id}/7`, asTime);
    await heading();

    expect(screen.getByText('1 × 8-10 s · RIR 3-4')).toBeVisible();
    await showDetails(user);
    const chips = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(chips.map((chip) => chip.textContent)).toEqual(['1 serie', '8-10 s', 'RIR 3-4']);
  });

  it('AC-24: con el mismo mínimo y máximo de RIR, "RIR 4"', async () => {
    const { services, workout } = await withWorkout();
    const deload = editView(services, (view) => ({
      ...view,
      workout: {
        ...view.workout,
        items: view.workout.items.map((i) => ({ ...i, targetRir: [4, 4] as [number, number] })),
      },
    }));
    const { user } = await open(`/sesion/${workout.id}/2`, deload);
    await heading();

    expect(screen.getByText('2 × 6-10 · RIR 4')).toBeVisible();
    await showDetails(user);
    expect(within(screen.getByRole('list')).getByText('RIR 4')).toBeVisible();
  });
});

describe('navegación', () => {
  it('AC-25: "Anterior" y "Siguiente" llevan al vecino; no existen en los extremos', async () => {
    const { services, workout } = await withWorkout();
    const { router, user } = await open(`/sesion/${workout.id}/2`, services);
    await heading();
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute(
      'href',
      `/sesion/${workout.id}/1`,
    );

    await tapToNavigate(user, screen.getByRole('link', { name: 'Siguiente' }));

    expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/3`);
    expect(router.state.historyAction).toBe('PUSH');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dominadas');
    });
    // Focus moves in an effect, after the new exercise is on screen.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    });

    await tapToNavigate(user, screen.getByRole('link', { name: 'Anterior' }));
    await screen.findByText('Ejercicio 2 de 7');
    await tapToNavigate(user, screen.getByRole('link', { name: 'Anterior' }));
    await screen.findByText('Ejercicio 1 de 7');
    expect(screen.queryByRole('link', { name: 'Anterior' })).not.toBeInTheDocument();
  });

  it('AC-25: el penúltimo tiene "Siguiente" y el último no', async () => {
    const { services, workout } = await withWorkout();
    await open(`/sesion/${workout.id}/6`, services);
    await heading();
    expect(screen.getByRole('link', { name: 'Siguiente' })).toHaveAttribute(
      'href',
      `/sesion/${workout.id}/7`,
    );
  });

  it('AC-25: en el último no hay "Siguiente"', async () => {
    const { services, workout } = await withWorkout();
    await open(`/sesion/${workout.id}/7`, services);
    await heading();

    expect(screen.queryByRole('link', { name: 'Siguiente' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anterior' })).toBeInTheDocument();
  });

  it('spec 004 AC-7: elegir un ejercicio del menú navega a él y el foco va a su nombre', async () => {
    const { services, workout } = await withWorkout();
    const { router, user } = await open(`/sesion/${workout.id}/1`, services);
    await heading();

    await user.click(screen.getByRole('button', { name: 'Ejercicio 1 de 7' }));
    const menu = screen.getByRole('dialog', { name: 'Full body A' });
    await tapToNavigate(user, within(menu).getByRole('button', { name: /^Curl femoral/ }));

    expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/4`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Curl femoral' })).toHaveFocus();
    });
  });

  it.each(['9', 'abc', '0', '2.5'])(
    'AC-27: /sesion/<id>/%s redirige con replace al primer ejercicio con series pendientes',
    async (index) => {
      const { services, workout } = await withWorkout();
      await done(services.training, workout, 1, 1);
      await done(services.training, workout, 1, 2);
      const { router } = await open(`/sesion/${workout.id}/${index}`, services);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/2`);
      });
      expect(router.state.historyAction).toBe('REPLACE');
    },
  );

  it('AC-4: "Continuar" (/sesion/<id>) abre el ejercicio pendiente con lo ya registrado', async () => {
    const { services, workout } = await withWorkout();
    await done(services.training, workout, 1, 1);
    await done(services.training, workout, 1, 2);
    await done(services.training, workout, 2, 1);
    const fourth = (await setsOf(services.training, workout, 2)).find((s) => s.setNumber === 2);
    await services.training.logSet(fourth?.id ?? ('' as ID), { weightKg: 62.5 });
    const { router } = await open(`/sesion/${workout.id}`, services);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/2`);
    });
    expect(await screen.findByRole('checkbox', { name: 'Serie 1 hecha' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Serie 2, kilos' })).toHaveValue('62,5');
  });

  it('sin series pendientes, va al último ejercicio', async () => {
    const { services, workout } = await withWorkout();
    for (const item of workout.items) {
      for (const set of await setsOf(services.training, workout, item.order)) {
        await done(services.training, workout, item.order, set.setNumber);
      }
    }
    const { router } = await open(`/sesion/${workout.id}`, services);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/7`);
    });
  });
});

describe('sesión no disponible', () => {
  async function expectUnavailable() {
    expect(await screen.findByText('Esta sesión ya no está disponible.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Hoy' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  }

  it('AC-28: un workout inexistente', async () => {
    const { services } = await withWorkout();
    await open('/sesion/no-existe/1', services);

    await expectUnavailable();
  });

  it('AC-28: un workout descartado', async () => {
    const { services, workout } = await withWorkout();
    await services.training.discardWorkout(workout.id);
    await open(`/sesion/${workout.id}/1`, services);

    await expectUnavailable();
  });

  it('AC-28: un workout completado', async () => {
    const { services, workout } = await withWorkout();
    const completed = editView(services, (view) => ({
      ...view,
      workout: { ...view.workout, status: 'completed' },
    }));
    await open(`/sesion/${workout.id}/1`, completed);

    await expectUnavailable();
  });

  it('mientras carga, nada más que el título de la pestaña', () => {
    const services = { ...createTestServices(), ready: new Promise<void>(() => undefined) };
    renderRouteWhileLoading('/sesion/w/1', services);

    expect(document.title).toBe('Sesión · Gym');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('el tiempo de la sesión (spec 004 AC-2, AC-3)', () => {
  const STARTED = fixedClock('2026-11-16T18:00:00-06:00');

  async function startedAt18(pageClock: string) {
    const services = createTestServices({ seedClock: STARTED, clock: fixedClock(pageClock) });
    await services.ready;
    const result = await services.training.startWorkout(MONDAY);
    if (!result.ok) throw new Error(result.error.code);
    return { services, workout: result.value };
  }

  it('AC-2: el encabezado muestra el tiempo desde el inicio, con su nombre para lectores', async () => {
    const { services, workout } = await startedAt18('2026-11-16T18:18:42-06:00');
    await open(`/sesion/${workout.id}/2`, services);
    await heading();

    const time = screen.getByText('18:42');
    expect(time.parentElement).toHaveTextContent('Tiempo de sesión 18:42');
    expect(screen.getByText('Tiempo de sesión', { exact: false })).toHaveClass('visually-hidden');
  });

  it('AC-3: una sesión de otro día no muestra el tiempo', async () => {
    const { services, workout } = await startedAt18('2026-11-17T09:00:00-06:00');
    await open(`/sesion/${workout.id}/2`, services);
    await heading();

    expect(screen.queryByText('Tiempo de sesión', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ejercicio 2 de 7' })).toBeInTheDocument();
  });
});

describe('Descartar sesión', () => {
  async function openDiscard() {
    const { services, workout } = await withWorkout();
    const opened = await open(`/sesion/${workout.id}/2`, services);
    await heading();
    // Until T10 brings the exit sheet, the arrow opens the discard confirmation (spec 004 T6).
    await opened.user.click(screen.getByRole('button', { name: 'Salir de la sesión' }));
    return { ...opened, services, workout };
  }

  it('AC-34: confirmar la descarta y vuelve a "Hoy" con replace', async () => {
    const { router, services, user, workout } = await openDiscard();
    const dialog = screen.getByRole('dialog', { name: '¿Descartar la sesión?' });
    expect(dialog).toHaveAccessibleDescription(
      'No registraste ninguna serie. No se puede deshacer.',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Sí, descartar' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(router.state.historyAction).toBe('REPLACE');
    expect((await services.training.getWorkout(workout.id))?.status).toBe('discarded');
  });

  it('spec 003 AC-26: el mismo texto que en "Hoy", con las series ya hechas', async () => {
    const { services, workout } = await withWorkout();
    await done(services.training, workout, 1, 1);
    await done(services.training, workout, 1, 2);
    await done(services.training, workout, 2, 1);
    const { user } = await open(`/sesion/${workout.id}/2`, services);
    await heading();
    await user.click(screen.getByRole('button', { name: 'Salir de la sesión' }));

    const dialog = screen.getByRole('dialog', { name: '¿Descartar la sesión?' });
    expect(dialog).toHaveAccessibleDescription(
      'Las 3 series que registraste en 2 ejercicios no contarán en tu historial. No se puede deshacer.',
    );
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sí, descartar' })).toBeInTheDocument();
  });

  it('AC-34: cancelar no cambia nada (P-2)', async () => {
    const { router, services, user, workout } = await openDiscard();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/2`);
    expect((await services.training.getWorkout(workout.id))?.status).toBe('in_progress');
  });
});
