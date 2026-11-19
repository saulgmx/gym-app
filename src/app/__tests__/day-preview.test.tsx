import 'fake-indexeddb/auto';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { err, fixedClock, type Clock, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import {
  closeTestDatabases,
  createTestServices,
  renderRoute,
  renderRouteWhileLoading,
  tapToNavigate,
} from './test-app';

// Another workout day of this week in /dia/:date (spec 002 AC-8, RN-TRN-14, plan §6.7) over the
// real seed. Dates checked with Node: 2026-11-16 Monday, 19 Thursday (rest), 20 Friday (Full
// body A), 21 Saturday (cardio), 22 Sunday; 2026-11-14 is the Saturday before, 23 the Monday after.

const at = (day: string) => fixedClock(`${day}T08:00:00-06:00`);
const SATURDAY = at('2026-11-21');

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

async function openDay(
  path: string,
  services: AppServices = createTestServices({ clock: SATURDAY }),
) {
  const router = await renderRoute(path, services);
  return { router, services, user: userEvent.setup() };
}

describe('DayPreviewPage', () => {
  it('AC-8: muestra la fecha, la sesión de ese día y sus ejercicios', async () => {
    await openDay('/dia/2026-11-20');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Viernes 20 de noviembre' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Full body A' })).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByRole('link', { name: 'Volver a Hoy' })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Vie 20 · Gym');
  });

  it('spec 003 plan §6.11: el RIR va una vez bajo el título de la sesión, no en cada ejercicio', async () => {
    await openDay('/dia/2026-11-20');

    const title = await screen.findByRole('heading', { level: 2, name: 'Full body A' });
    expect(screen.getAllByText(/RIR/)).toHaveLength(1);
    expect(title.nextElementSibling).toHaveTextContent('RIR 3-4');
    for (const exercise of within(screen.getByRole('list')).getAllByRole('listitem')) {
      expect(exercise).not.toHaveTextContent('RIR');
    }
  });

  it('AC-8: "Empezar sesión" crea el workout de hoy con el plan del viernes (RN-TRN-14)', async () => {
    const { router, services, user } = await openDay('/dia/2026-11-20');

    await user.click(await screen.findByRole('button', { name: 'Empezar sesión' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/sesion\/[^/]+\/1$/);
    });
    const workout = await services.training.getActiveWorkout();
    expect(workout).toMatchObject({
      name: 'Full body A',
      date: '2026-11-21',
      plannedFor: '2026-11-20',
    });
    expect(workout?.items).toHaveLength(7);
    // The new active session must not send the page back to "Hoy" on its way out.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(router.state.location.pathname).toBe(`/sesion/${workout?.id ?? ''}/1`);
  });

  it('AC-8: se llega desde "Otra sesión de esta semana" en "Hoy"', async () => {
    const { router, user } = await openDay('/');

    await tapToNavigate(user, await screen.findByRole('link', { name: 'Vie 20 · Full body A' }));

    expect(router.state.location.pathname).toBe('/dia/2026-11-20');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Viernes 20 de noviembre' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['no es una fecha', 'viernes', '2026-11-21'],
    ['fecha inexistente', '2026-02-30', '2026-11-21'],
    // Read as a plain date it would be Friday 4 December, a workout day of that week.
    ['fecha inexistente que cae en la semana', '2026-11-34', '2026-12-05'],
    ['semana anterior', '2026-11-14', '2026-11-21'],
    ['semana siguiente', '2026-11-23', '2026-11-21'],
    ['hoy, día de pesas', '2026-11-20', '2026-11-20'],
    ['día de descanso', '2026-11-19', '2026-11-21'],
  ])('redirige a "Hoy" con replace: %s', async (_, day, today) => {
    const { router } = await openDay(`/dia/${day}`, createTestServices({ clock: at(today) }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('con una sesión activa redirige a "Hoy"', async () => {
    const services = createTestServices({ clock: SATURDAY });
    await services.ready;
    await services.training.startWorkout('2026-11-21' as LocalDate, {
      plannedFor: '2026-11-16' as LocalDate,
    });
    const { router } = await openDay('/dia/2026-11-20', services);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('mientras carga, solo "Volver a Hoy"', () => {
    const services = {
      ...createTestServices({ clock: SATURDAY }),
      ready: new Promise<void>(() => undefined),
    };
    renderRouteWhileLoading('/dia/2026-11-20', services);

    expect(screen.getByRole('link', { name: 'Volver a Hoy' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empezar sesión' })).not.toBeInTheDocument();
  });

  it('"Hoy" sigue marcada en la barra inferior', async () => {
    await openDay('/dia/2026-11-20');
    await screen.findByRole('heading', { level: 1, name: 'Viernes 20 de noviembre' });

    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Progreso' })).not.toHaveAttribute('aria-current');
  });

  it('al volver a primer plano en la semana siguiente, redirige', async () => {
    let today = '2026-11-21' as LocalDate;
    const clock: Clock = { now: () => `${today}T08:00:00-06:00` as never, today: () => today };
    const { router } = await openDay('/dia/2026-11-20', createTestServices({ clock }));
    await screen.findByRole('heading', { level: 1, name: 'Viernes 20 de noviembre' });

    today = '2026-11-23' as LocalDate;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });
});

// Spec 005 AC-35 (spec §8, decision 17; plan §6.7): the preview of a day already done.
describe('DayPreviewPage con un día hecho (spec 005)', () => {
  /** Starts a session for `plannedFor`, marks one set, records pain and closes it. */
  async function closeDay(services: AppServices, on: string, plannedFor: string) {
    const started = await services.training.startWorkout(on as LocalDate, {
      plannedFor: plannedFor as LocalDate,
    });
    if (!started.ok) throw new Error(started.error.code);
    const view = await services.training.getWorkoutView(started.value.id);
    const set = view?.sets[0];
    if (!set) throw new Error('no set');
    await services.training.logSet(set.id, { weightKg: 60, reps: 10, rir: 3 });
    await services.training.toggleSetDone(set.id);
    await services.health.recordPain(started.value.id, {
      level: 2,
      redFlags: [],
      date: started.value.date,
    });
    const finished = await services.training.finishWorkout(started.value.id, {});
    if (!finished.ok) throw new Error(finished.error.code);
  }

  it('AC-35: el lunes hecho, abierto el miércoles, dice "Ya hiciste esta sesión." sin "Empezar sesión"', async () => {
    const services = createTestServices({ clock: at('2026-11-18') });
    await services.ready;
    await closeDay(services, '2026-11-16', '2026-11-16');

    await openDay('/dia/2026-11-16', services);

    expect(await screen.findByText('Ya hiciste esta sesión.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Full body A' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0); // the exercises stay
    expect(screen.queryByRole('button', { name: 'Empezar sesión' })).not.toBeInTheDocument();
  });

  it('plan §6.7: si otra pestaña cierra ese día con la vista previa abierta, el botón pasa al texto', async () => {
    const { services } = await openDay('/dia/2026-11-20');
    await screen.findByRole('button', { name: 'Empezar sesión' });

    await act(() => closeDay(services, '2026-11-21', '2026-11-20'));

    expect(await screen.findByText('Ya hiciste esta sesión.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empezar sesión' })).not.toBeInTheDocument();
  });

  it('RN-TRN-24: si "Empezar sesión" devuelve already-done, lo dice bajo el botón', async () => {
    const services = createTestServices({ clock: SATURDAY });
    const refusing: AppServices = {
      ...services,
      training: {
        ...services.training,
        startWorkout: () =>
          Promise.resolve(
            err({ code: 'training/already-done' as const, message: 'done (RN-TRN-24)' }),
          ),
      },
    };
    const { user } = await openDay('/dia/2026-11-20', refusing);

    await user.click(await screen.findByRole('button', { name: 'Empezar sesión' }));

    expect(await screen.findByText('Ya hiciste esta sesión.')).toBeInTheDocument();
  });

  it('plan §6.7: no muestra "Empezar sesión" hasta saber si el día está hecho', async () => {
    const services = createTestServices({ clock: SATURDAY });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow: AppServices = {
      ...services,
      training: {
        ...services.training,
        listWorkouts: async (range) => {
          await gate;
          return services.training.listWorkouts(range);
        },
      },
    };
    await openDay('/dia/2026-11-20', slow);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(screen.queryByRole('button', { name: 'Empezar sesión' })).not.toBeInTheDocument();

    await act(async () => {
      release();
      await gate;
    });
    expect(await screen.findByRole('button', { name: 'Empezar sesión' })).toBeInTheDocument();
  });

  it('spec §8, decisión 17: la vista previa de hoy, aunque esté hecho, sigue llevando a "Hoy"', async () => {
    const services = createTestServices({ clock: at('2026-11-18') });
    await services.ready;
    await closeDay(services, '2026-11-18', '2026-11-18');

    const { router } = await openDay('/dia/2026-11-18', services);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(router.state.historyAction).toBe('REPLACE');
  });
});
