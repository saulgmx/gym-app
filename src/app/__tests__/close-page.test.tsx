import 'fake-indexeddb/auto';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HealthApi } from '@/modules/health';
import type { TrainingApi, Workout } from '@/modules/training';
import { err, fixedClock, type Clock, type Instant, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import { GENERIC_ERROR_MESSAGE } from '../errors/messages';
import { closeTestDatabases, createTestServices, renderRoute, type Entry } from './test-app';

// The Cierre page (spec 005 AC-7 to AC-31; plan §6.5, §6.6) over the real seed and IndexedDB.
// Monday 2026-11-16 is Full body A of week 1: 7 exercises and 10 sets (Prensa, Press de banca and
// Dominadas with 2 each, the other four with 1). The session starts at 18:00 (training's clock).

const MONDAY = '2026-11-16' as LocalDate;
const STARTED = fixedClock('2026-11-16T18:00:00-06:00');
const AT_18_52 = fixedClock('2026-11-16T18:52:00-06:00');

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

async function withWorkout(clock = AT_18_52) {
  const services = createTestServices({ clock, seedClock: STARTED });
  await services.ready;
  const result = await services.training.startWorkout(MONDAY);
  if (!result.ok) throw new Error(result.error.code);
  return { services, workout: result.value };
}

/** Logs and marks a set, as the user would. */
async function done(training: TrainingApi, workout: Workout, order: number, setNumber: number) {
  const view = await training.getWorkoutView(workout.id);
  const exerciseId = workout.items.find((i) => i.order === order)?.exerciseId;
  const set = view?.sets.find((s) => s.exerciseId === exerciseId && s.setNumber === setNumber);
  if (!view || !set) throw new Error(`No set ${String(setNumber)} in item ${String(order)}`);
  const weighted = view.exercises[set.exerciseId]?.metric === 'weight';
  await training.logSet(
    set.id,
    weighted ? { weightKg: 60, reps: 10, rir: 3 } : { reps: 10, rir: 3 },
  );
  const marked = await training.toggleSetDone(set.id);
  if (!marked.ok) throw new Error(marked.error.code);
}

/** The full example: all 10 sets. */
async function doAll(training: TrainingApi, workout: Workout) {
  for (const item of workout.items) {
    for (let n = 1; n <= item.plannedSets; n++) await done(training, workout, item.order, n);
  }
}

/** The partial example: both Prensa sets, the 1st Press de banca and both Dominadas (5 in 3). */
async function doPartial(training: TrainingApi, workout: Workout) {
  await done(training, workout, 1, 1);
  await done(training, workout, 1, 2);
  await done(training, workout, 2, 1);
  await done(training, workout, 3, 1);
  await done(training, workout, 3, 2);
}

const closePath = (workout: Workout) => `/sesion/${workout.id}/cierre`;

async function open(entry: Entry, services: AppServices) {
  const router = await renderRoute(entry, services);
  return { router, user: userEvent.setup() };
}

const saveButton = () => screen.getByRole('button', { name: /Guardar sesión|Guardando…/ });
const painButton = (n: number) =>
  within(screen.getByRole('group', { name: 'Dolor lumbar' })).getByRole('button', {
    name: String(n),
  });
const summaryValues = () =>
  [...document.querySelectorAll('dl dd')].map((dd) => dd.textContent.replace(/\s+/g, ' ').trim());

function withHealth(services: AppServices, overrides: Partial<HealthApi>): AppServices {
  return { ...services, health: { ...services.health, ...overrides } };
}
function withTraining(services: AppServices, overrides: Partial<TrainingApi>): AppServices {
  return { ...services, training: { ...services.training, ...overrides } };
}

/** A promise the test resolves by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('encabezado y resumen', () => {
  it('AC-7: "Sesión terminada", la fecha y la sesión, y 52 min, 10 series y 7 ejercicios', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);

    await open(closePath(workout), services);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sesión terminada' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Lunes 16 de noviembre · Full body A')).toBeInTheDocument();
    expect(summaryValues()).toEqual(['52 min', '10 series', '7 ejercicios']);
    expect([...document.querySelectorAll('dl dt')].map((dt) => dt.textContent)).toEqual([
      'Duración',
      'Series hechas',
      'Ejercicios',
    ]);
    expect(document.title).toBe('Cierre de sesión · Gym');
  });

  it('AC-8: el ejemplo parcial a las 18:30 da 30 min, 5 series y 3 de 7 ejercicios', async () => {
    const { services, workout } = await withWorkout(fixedClock('2026-11-16T18:30:00-06:00'));
    await doPartial(services.training, workout);

    await open(closePath(workout), services);

    await screen.findByRole('heading', { level: 1, name: 'Sesión terminada' });
    expect(summaryValues()).toEqual(['30 min', '5 series', '3 de 7 ejercicios']);
  });

  it('AC-9: abierto otro día, el resumen no muestra los minutos', async () => {
    const { services, workout } = await withWorkout(fixedClock('2026-11-17T09:00:00-06:00'));
    await doPartial(services.training, workout);

    await open(closePath(workout), services);

    await screen.findByRole('heading', { level: 1, name: 'Sesión terminada' });
    expect(summaryValues()).toEqual(['5 series', '3 de 7 ejercicios']);
    expect(screen.queryByText('Duración')).not.toBeInTheDocument();
  });

  it('plan §6.5: con una serie, "1 serie" y "1 de 7 ejercicios"', async () => {
    const { services, workout } = await withWorkout();
    await done(services.training, workout, 1, 1);

    await open(closePath(workout), services);

    await screen.findByRole('heading', { level: 1, name: 'Sesión terminada' });
    expect(summaryValues()).toEqual(['52 min', '1 serie', '1 de 7 ejercicios']);
  });

  it('spec §7: si otra pestaña marca una serie, el resumen se recalcula', async () => {
    const { services, workout } = await withWorkout();
    await doPartial(services.training, workout);
    await open(closePath(workout), services);
    await screen.findByRole('heading', { level: 1, name: 'Sesión terminada' });

    await act(() => done(services.training, workout, 2, 2));

    await waitFor(() => {
      expect(summaryValues()).toEqual(['52 min', '6 series', '3 de 7 ejercicios']);
    });
  });

  it('spec §6.1: los minutos se calculan al abrir y no cambian con el reloj', async () => {
    // A clock one minute later on every read: a page that reads `now` again would move.
    let minute = 52;
    const ticking: Clock = {
      now: () => `2026-11-16T18:${String(minute++).padStart(2, '0')}:00-06:00` as Instant,
      today: () => MONDAY,
    };
    const { services, workout } = await withWorkout(ticking);
    await doPartial(services.training, workout);
    await open(closePath(workout), services);
    await screen.findByRole('heading', { level: 1, name: 'Sesión terminada' });
    const opened = summaryValues()[0];

    await act(() => done(services.training, workout, 2, 2));

    await waitFor(() => {
      expect(summaryValues()[1]).toBe('6 series');
    });
    expect(summaryValues()[0]).toBe(opened);
  });

  it('una sesión del viernes cerrada el sábado: su fecha, sin minutos, y el dolor con su día', async () => {
    const services = createTestServices({
      clock: fixedClock('2026-11-21T09:00:00-06:00'),
      seedClock: fixedClock('2026-11-20T18:00:00-06:00'),
    });
    await services.ready;
    const started = await services.training.startWorkout('2026-11-20' as LocalDate);
    if (!started.ok) throw new Error(started.error.code);
    const workout = started.value;
    await doPartial(services.training, workout);
    const { router, user } = await open(closePath(workout), services);

    expect(await screen.findByText('Viernes 20 de noviembre · Full body A')).toBeInTheDocument();
    expect(summaryValues()).toEqual(['5 series', '3 de 7 ejercicios']);
    await user.click(screen.getByRole('button', { name: '2' }));
    await act(() => user.click(saveButton()));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect((await services.health.getPainSummary()).latest?.date).toBe('2026-11-20');
  });
});

describe('dolor, banderas y notas', () => {
  it('AC-10: ningún nivel elegido, sin mensaje; "Guardar sesión" deshabilitado con su ayuda', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);

    await open(closePath(workout), services);

    await screen.findByRole('group', { name: 'Dolor lumbar' });
    expect(screen.queryAllByRole('button', { pressed: true })).toEqual([]);
    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveTextContent('Guardar sesión');
    expect(saveButton()).toHaveAccessibleDescription('Elige el nivel de dolor para poder guardar');
    expect(screen.getByText('Elige el nivel de dolor para poder guardar')).toBeVisible();
  });

  it('AC-11: al elegir 2, el mensaje aparece, "Guardar sesión" se habilita y la ayuda desaparece', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const { user } = await open(closePath(workout), services);

    await user.click(await screen.findByRole('button', { name: '2' }));

    expect(painButton(2)).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText('Molestia leve, dentro de lo normal. Sigue con el plan.'),
    ).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
    expect(
      screen.queryByText('Elige el nivel de dolor para poder guardar'),
    ).not.toBeInTheDocument();
  });

  it('AC-13, AC-14: las banderas, y el aviso al marcar una aunque no haya nivel', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const { user } = await open(closePath(workout), services);

    await user.click(await screen.findByRole('checkbox', { name: 'Hormigueo o adormecimiento' }));

    expect(
      screen.getByText(
        'Consulta a un médico antes de seguir entrenando. No se sugerirá subir carga.',
      ),
    ).toBeInTheDocument();
  });

  it('AC-16: el campo de notas, vacío, con su etiqueta y un máximo de 2000 caracteres', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);

    await open(closePath(workout), services);

    const notes = await screen.findByRole('textbox', { name: 'Notas de la sesión (opcional)' });
    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes).toHaveValue('');
    expect(notes).toHaveAttribute('maxlength', '2000');
  });
});

describe('guardar', () => {
  it('AC-18: guarda el dolor y luego cierra con las notas, y vuelve a "Hoy" con replace', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const calls: string[] = [];
    const spied = withTraining(
      withHealth(services, {
        recordPain: (id, input) => {
          calls.push('recordPain');
          return services.health.recordPain(id, input);
        },
      }),
      {
        finishWorkout: (id, input) => {
          calls.push('finishWorkout');
          return services.training.finishWorkout(id, input);
        },
      },
    );
    const { router, user } = await open(closePath(workout), spied);

    await user.click(await screen.findByRole('button', { name: '2' }));
    await user.click(screen.getByRole('checkbox', { name: 'Hormigueo o adormecimiento' }));
    await user.type(screen.getByRole('textbox'), 'Buena sesión');
    await act(() => user.click(saveButton()));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(router.state.historyAction).toBe('REPLACE');
    expect(calls).toEqual(['recordPain', 'finishWorkout']);
    const summary = await services.health.getPainSummary();
    expect(summary.latest).toMatchObject({
      workoutId: workout.id,
      level: 2,
      redFlags: ['numbness'],
      date: MONDAY,
    });
    expect(await services.training.getWorkout(workout.id)).toMatchObject({
      status: 'completed',
      finishedAt: STARTED.now(),
      notes: 'Buena sesión',
    });
  });

  it('AC-19: con la nota solo de espacios, el workout no tiene notes', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const { router, user } = await open(closePath(workout), services);

    await user.click(await screen.findByRole('button', { name: '0' }));
    await user.type(screen.getByRole('textbox'), '   ');
    await act(() => user.click(saveButton()));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(await services.training.getWorkout(workout.id)).not.toHaveProperty('notes');
  });

  it('AC-20: el ejemplo parcial se guarda completed y las 5 series no hechas siguen', async () => {
    const { services, workout } = await withWorkout();
    await doPartial(services.training, workout);
    const { router, user } = await open(closePath(workout), services);

    await user.click(await screen.findByRole('button', { name: '3' }));
    await act(() => user.click(saveButton()));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    const view = await services.training.getWorkoutView(workout.id);
    expect(view?.workout.status).toBe('completed');
    expect(view?.sets.filter((s) => !s.done)).toHaveLength(5);
  });

  it('AC-25: si guardar el dolor rechaza, no cierra, muestra el error genérico y se puede reintentar', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const finish = vi.fn((...args: Parameters<TrainingApi['finishWorkout']>) =>
      services.training.finishWorkout(...args),
    );
    let fail = true;
    const spied = withTraining(
      withHealth(services, {
        recordPain: (id, input) =>
          fail ? Promise.reject(new Error('disk failure')) : services.health.recordPain(id, input),
      }),
      { finishWorkout: finish },
    );
    const { router, user } = await open(closePath(workout), spied);
    await user.click(await screen.findByRole('button', { name: '4' }));

    await act(() => user.click(saveButton()));

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(finish).not.toHaveBeenCalled();
    expect((await services.training.getWorkout(workout.id))?.status).toBe('in_progress');
    expect(router.state.location.pathname).toBe(closePath(workout));
    expect(painButton(4)).toHaveAttribute('aria-pressed', 'true');
    expect(saveButton()).toHaveTextContent('Guardar sesión');
    expect(saveButton()).toBeEnabled();

    fail = false;
    await act(() => user.click(saveButton()));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('AC-25: un error con Result al guardar el dolor muestra su texto de app', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const spied = withHealth(services, {
      recordPain: () =>
        Promise.resolve(
          err({ code: 'health/pain-out-of-range' as const, message: 'out (RN-HLT-01)' }),
        ),
    });
    const { user } = await open(closePath(workout), spied);
    await user.click(await screen.findByRole('button', { name: '4' }));

    await act(() => user.click(saveButton()));

    expect(await screen.findByRole('alert')).toHaveTextContent('El dolor va de 0 a 10.');
  });

  it('AC-26: si el dolor se guarda y cerrar rechaza, al reintentar se reemplaza y no se duplica', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const record = vi.fn((...args: Parameters<HealthApi['recordPain']>) =>
      services.health.recordPain(...args),
    );
    let fail = true;
    const spied = withTraining(withHealth(services, { recordPain: record }), {
      finishWorkout: (id, input) =>
        fail
          ? Promise.reject(new Error('disk failure'))
          : services.training.finishWorkout(id, input),
    });
    const { router, user } = await open(closePath(workout), spied);
    await user.click(await screen.findByRole('button', { name: '5' }));

    await act(() => user.click(saveButton()));

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(await services.health.hasPainEntry(workout.id)).toBe(true);

    fail = false;
    await user.click(painButton(6));
    await act(() => user.click(saveButton()));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(record).toHaveBeenCalledTimes(2);
    expect((await services.health.getPainSummary()).latest).toMatchObject({
      workoutId: workout.id,
      level: 6,
    });
  });

  it('AC-27: mientras guarda, el botón dice "Guardando…" y está deshabilitado; se guarda una vez', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const gate = deferred<undefined>();
    const record = vi.fn(async (...args: Parameters<HealthApi['recordPain']>) => {
      await gate.promise;
      return services.health.recordPain(...args);
    });
    const { router, user } = await open(
      closePath(workout),
      withHealth(services, { recordPain: record }),
    );
    await user.click(await screen.findByRole('button', { name: '2' }));

    await user.click(saveButton());
    await user.click(saveButton());

    expect(saveButton()).toHaveTextContent('Guardando…');
    expect(saveButton()).toBeDisabled();
    expect(record).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve(undefined);
      await gate.promise;
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('plan §6.5: al cerrar desde esta página no aparece "Esta sesión ya está guardada."', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const gate = deferred<undefined>();
    const spied = withTraining(services, {
      finishWorkout: async (id, input) => {
        const result = await services.training.finishWorkout(id, input);
        await gate.promise; // the live view sees `completed` before the page navigates
        return result;
      },
    });
    const { router, user } = await open(closePath(workout), spied);
    await user.click(await screen.findByRole('button', { name: '2' }));

    await user.click(saveButton());
    await waitFor(async () => {
      expect((await services.training.getWorkout(workout.id))?.status).toBe('completed');
    });
    await act(() => new Promise((r) => setTimeout(r, 50)));

    expect(screen.queryByText('Esta sesión ya está guardada.')).not.toBeInTheDocument();

    await act(async () => {
      gate.resolve(undefined);
      await gate.promise;
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });
});

describe('volver a la sesión', () => {
  it('AC-21: llegando desde el ejercicio 7, vuelve a /sesion/<id>/7 y no guarda nada', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const { router, user } = await open(
      { pathname: closePath(workout), state: { from: 7 } },
      services,
    );
    await user.click(await screen.findByRole('button', { name: '3' }));

    await act(() => user.click(screen.getByRole('link', { name: 'Volver a la sesión' })));

    expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/7`);
    expect(router.state.historyAction).toBe('PUSH');
    expect((await services.training.getWorkout(workout.id))?.status).toBe('in_progress');
    expect(await services.health.hasPainEntry(workout.id)).toBe(false);
  });

  it('AC-22: desde el ejercicio 2 vuelve al 2; al abrir el Cierre otra vez, el dolor empieza sin elegir', async () => {
    const { services, workout } = await withWorkout();
    await doPartial(services.training, workout);
    const { router, user } = await open(
      { pathname: closePath(workout), state: { from: 2 } },
      services,
    );
    await user.click(await screen.findByRole('button', { name: '4' }));

    await act(() => user.click(screen.getByRole('link', { name: 'Volver a la sesión' })));
    expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/2`);

    await act(() => router.navigate(closePath(workout), { state: { from: 2 } }));

    await screen.findByRole('group', { name: 'Dolor lumbar' });
    expect(screen.queryAllByRole('button', { pressed: true })).toEqual([]);
  });

  it('AC-23: sin state, vuelve al ejercicio actual de RN-TRN-21', async () => {
    const { services, workout } = await withWorkout();
    await doPartial(services.training, workout); // Press de banca (2) has its 2nd set pending

    await open(closePath(workout), services);

    expect(await screen.findByRole('link', { name: 'Volver a la sesión' })).toHaveAttribute(
      'href',
      `/sesion/${workout.id}/2`,
    );
  });

  it('AC-23: sin state y con todo hecho, vuelve al ejercicio 1', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);

    await open(closePath(workout), services);

    expect(await screen.findByRole('link', { name: 'Volver a la sesión' })).toHaveAttribute(
      'href',
      `/sesion/${workout.id}/1`,
    );
  });

  it.each([99, 0, 2.5, '3', null])(
    'plan §6.6: un state.from inválido (%j) usa el ejercicio actual',
    async (from) => {
      const { services, workout } = await withWorkout();
      await doPartial(services.training, workout);

      await open({ pathname: closePath(workout), state: { from } }, services);

      expect(await screen.findByRole('link', { name: 'Volver a la sesión' })).toHaveAttribute(
        'href',
        `/sesion/${workout.id}/2`,
      );
    },
  );

  it('AC-24: salir del Cierre sin guardar deja la sesión en curso', async () => {
    const { services, workout } = await withWorkout();
    await doAll(services.training, workout);
    const { router, user } = await open(closePath(workout), services);
    await user.click(await screen.findByRole('button', { name: '2' }));

    await act(() => router.navigate('/'));

    expect((await services.training.getWorkout(workout.id))?.status).toBe('in_progress');
    expect(await services.health.hasPainEntry(workout.id)).toBe(false);
  });
});

describe('sesiones que no se pueden cerrar', () => {
  async function closed(services: AppServices, workout: Workout) {
    await doPartial(services.training, workout);
    const recorded = await services.health.recordPain(workout.id, {
      level: 2,
      redFlags: [],
      date: workout.date,
    });
    if (!recorded.ok) throw new Error(recorded.error.code);
    const finished = await services.training.finishWorkout(workout.id, {});
    if (!finished.ok) throw new Error(finished.error.code);
  }

  it('AC-28: un workout ya completed → "Esta sesión ya está guardada." y "Volver a Hoy"', async () => {
    const { services, workout } = await withWorkout();
    await closed(services, workout);

    await open(closePath(workout), services);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cierre de sesión' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Esta sesión ya está guardada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Hoy' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('group', { name: 'Dolor lumbar' })).not.toBeInTheDocument();
  });

  it('AC-28: su /sesion/<id>/N también dice "Esta sesión ya está guardada."', async () => {
    const { services, workout } = await withWorkout();
    await closed(services, workout);

    await open(`/sesion/${workout.id}/1`, services);

    expect(await screen.findByText('Esta sesión ya está guardada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Hoy' })).toHaveAttribute('href', '/');
  });

  it('AC-29: un workout descartado → "Esta sesión ya no está disponible."', async () => {
    const { services, workout } = await withWorkout();
    await doPartial(services.training, workout);
    await services.training.discardWorkout(workout.id);

    await open(closePath(workout), services);

    expect(await screen.findByText('Esta sesión ya no está disponible.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Hoy' })).toHaveAttribute('href', '/');
  });

  it('AC-29: un workout inexistente → "Esta sesión ya no está disponible."', async () => {
    const { services } = await withWorkout();

    await open('/sesion/nadie/cierre', services);

    expect(await screen.findByText('Esta sesión ya no está disponible.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Cierre de sesión' })).toBeInTheDocument();
  });

  it('AC-30: sin series hechas → "No hay series hechas para guardar." y "Volver a la sesión"', async () => {
    const { services, workout } = await withWorkout();

    await open(closePath(workout), services);

    expect(await screen.findByText('No hay series hechas para guardar.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la sesión' })).toHaveAttribute(
      'href',
      `/sesion/${workout.id}/1`,
    );
    expect(screen.queryByRole('group', { name: 'Dolor lumbar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar sesión' })).not.toBeInTheDocument();
  });

  it('AC-31: si otra pestaña guarda, esta pasa a "Esta sesión ya está guardada."', async () => {
    const { services, workout } = await withWorkout();
    await doPartial(services.training, workout);
    await open(closePath(workout), services);
    await screen.findByRole('group', { name: 'Dolor lumbar' });

    await act(async () => {
      await services.health.recordPain(workout.id, { level: 1, redFlags: [], date: workout.date });
      await services.training.finishWorkout(workout.id, {});
    });

    expect(await screen.findByText('Esta sesión ya está guardada.')).toBeInTheDocument();
  });

  it('AC-31: si otra pestaña cerró justo antes de tocar "Guardar", se ve el mismo texto sin error', async () => {
    const { services, workout } = await withWorkout();
    await doPartial(services.training, workout);
    const spied = withTraining(services, {
      finishWorkout: async (id, input) => {
        // The other tab closes first; this tab then gets training/workout-closed.
        await services.training.finishWorkout(id, {});
        return services.training.finishWorkout(id, input);
      },
    });
    const { user } = await open(closePath(workout), spied);
    await user.click(await screen.findByRole('button', { name: '2' }));

    await act(() => user.click(saveButton()));

    expect(await screen.findByText('Esta sesión ya está guardada.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
