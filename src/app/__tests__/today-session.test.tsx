import 'fake-indexeddb/auto';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrainingApi, TrainingError, Workout } from '@/modules/training';
import { err, fixedClock, type ID, type LocalDate, type Result } from '@/shared/kernel';
import type { AppServices } from '../context';
import { closeTestDatabases, createTestServices, renderRoute } from './test-app';

// "Hoy" with the active session (spec 002 AC-1, AC-3, AC-5, AC-7, AC-9, AC-11, AC-34; plan §6.7)
// over the real seed. Dates checked with Node: 2026-11-16 Monday, 17 Tuesday (cardio), 18
// Wednesday (Full body B), 19 Thursday (rest), 20 Friday (Full body A), 21 Saturday (cardio).

const date = (s: string) => s as LocalDate;
const at = (day: string) => fixedClock(`${day}T08:00:00-06:00`);

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

/** Opens "Hoy" and waits for it to load: a tap while it is still suspended is lost (T19). */
async function openToday(
  day: string,
  services: AppServices = createTestServices({ clock: at(day) }),
) {
  const router = await renderRoute('/', services);
  await screen.findByRole('list', { name: 'Semana' });
  return { router, services, user: userEvent.setup() };
}

async function started(services: AppServices, day: string): Promise<Workout> {
  await services.ready;
  const result = await services.training.startWorkout(date(day));
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

const startButton = () => screen.queryByRole('button', { name: 'Iniciar sesión' });
const otherDays = () => screen.queryByRole('region', { name: 'Otra sesión de esta semana' });

describe('Iniciar sesión', () => {
  it('AC-1: el lunes crea el workout de Full body A y abre su primer ejercicio', async () => {
    const { router, services, user } = await openToday('2026-11-16');

    await user.click(await screen.findByRole('button', { name: 'Iniciar sesión' }));

    // It navigates once the workout is written.
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/sesion\/[^/]+\/1$/);
    });
    const workout = await services.training.getActiveWorkout();
    expect(router.state.location.pathname).toBe(`/sesion/${workout?.id ?? ''}/1`);
    expect(workout).toMatchObject({
      name: 'Full body A',
      date: '2026-11-16',
      plannedFor: '2026-11-16',
      programWeek: 1,
    });
    expect(workout?.items).toHaveLength(7);
  });

  it.each([
    ['martes 17 (cardio)', '2026-11-17'],
    ['jueves 19 (descanso)', '2026-11-19'],
  ])('AC-3: el %s no ofrece iniciar', async (_, day) => {
    await openToday(day);

    expect(startButton()).not.toBeInTheDocument();
  });

  it('se deshabilita mientras crea la sesión (sin doble toque)', async () => {
    const services = createTestServices({ clock: at('2026-11-16') });
    const startWorkout = vi.fn(() => new Promise<Result<Workout, TrainingError>>(() => undefined));
    const { user } = await openToday('2026-11-16', withTraining(services, { startWorkout }));
    const button = await screen.findByRole('button', { name: 'Iniciar sesión' });

    await user.click(button);
    await user.click(button);

    expect(button).toBeDisabled();
    expect(startWorkout).toHaveBeenCalledOnce();
  });

  it('si otra pestaña ya inició una, navega a esa sesión', async () => {
    const services = createTestServices({ clock: at('2026-11-16') });
    const startWorkout = () =>
      Promise.resolve(
        err<TrainingError>({
          code: 'training/workout-already-active',
          message: 'active',
          details: { workoutId: 'otra' as ID },
        }),
      );
    const { router, user } = await openToday(
      '2026-11-16',
      withTraining(services, { startWorkout }),
    );

    await user.click(await screen.findByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sesion/otra');
    });
  });

  it('con otro error muestra su texto bajo el botón y no navega', async () => {
    const services = createTestServices({ clock: at('2026-11-16') });
    const startWorkout = () =>
      Promise.resolve(err<TrainingError>({ code: 'training/no-plan-today', message: 'none' }));
    const { router, user } = await openToday(
      '2026-11-16',
      withTraining(services, { startWorkout }),
    );

    await user.click(await screen.findByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Hoy no toca pesas.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

function withTraining(services: AppServices, overrides: Partial<TrainingApi>): AppServices {
  return { ...services, training: { ...services.training, ...overrides } };
}

describe('Continuar sesión', () => {
  it('mientras carga la sesión activa no hay botones (nunca "Iniciar" de más)', async () => {
    const services = createTestServices({ clock: at('2026-11-16') });
    const getActiveWorkout = () => new Promise<Workout | undefined>(() => undefined);
    await renderRoute('/', withTraining(services, { getActiveWorkout }));
    // Long enough for the plan queries to answer.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Continuar/ })).not.toBeInTheDocument();
  });

  it('AC-5: una sesión de otro día muestra su fecha, "Descartar" y no deja iniciar otra', async () => {
    const services = createTestServices({ clock: at('2026-11-18') });
    const workout = await started(services, '2026-11-16');
    await openToday('2026-11-18', services);

    const current = await screen.findByRole('region', { name: 'Sesión en curso' });
    expect(current).toHaveTextContent('Full body A');
    expect(
      within(current).getByRole('link', { name: 'Continuar sesión del lunes 16 de noviembre' }),
    ).toHaveAttribute('href', `/sesion/${workout.id}`);
    expect(within(current).getByRole('button', { name: 'Descartar sesión' })).toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
    // The rest of "Hoy" stays: today is still Full body B.
    expect(screen.getByRole('heading', { level: 2, name: 'Full body B' })).toBeInTheDocument();
  });

  it('una sesión de hoy dice solo "Continuar sesión"', async () => {
    const services = createTestServices({ clock: at('2026-11-18') });
    await started(services, '2026-11-18');
    await openToday('2026-11-18', services);

    expect(await screen.findByRole('link', { name: 'Continuar sesión' })).toBeInTheDocument();
  });

  it('AC-11: con sesión activa no aparece "Otra sesión de esta semana"', async () => {
    const services = createTestServices({ clock: at('2026-11-21') });
    await services.ready;
    await services.training.startWorkout(date('2026-11-21'), { plannedFor: date('2026-11-20') });
    await openToday('2026-11-21', services);

    await screen.findByRole('region', { name: 'Sesión en curso' });
    expect(otherDays()).not.toBeInTheDocument();
  });
});

describe('Descartar sesión', () => {
  async function openWithSession() {
    const services = createTestServices({ clock: at('2026-11-18') });
    const workout = await started(services, '2026-11-18');
    const opened = await openToday('2026-11-18', services);
    await opened.user.click(await screen.findByRole('button', { name: 'Descartar sesión' }));
    return { ...opened, workout };
  }

  it('AC-34: confirmar la descarta y vuelve a ofrecer "Iniciar sesión"', async () => {
    const { services, user, workout } = await openWithSession();
    const dialog = screen.getByRole('dialog', { name: '¿Descartar la sesión?' });
    expect(dialog).toHaveTextContent('No contará en tu historial y no podrás retomarla.');

    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }));

    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sesión en curso' })).not.toBeInTheDocument();
    expect((await services.training.getWorkout(workout.id))?.status).toBe('discarded');
  });

  it('AC-34: cancelar no cambia nada (P-2)', async () => {
    const { services, user, workout } = await openWithSession();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sesión en curso' })).toBeInTheDocument();
    expect((await services.training.getWorkout(workout.id))?.status).toBe('in_progress');
  });

  it('si falla, muestra el motivo y la sesión sigue', async () => {
    const services = createTestServices({ clock: at('2026-11-18') });
    await started(services, '2026-11-18');
    const discardWorkout = () =>
      Promise.resolve(err<TrainingError>({ code: 'training/workout-closed', message: 'closed' }));
    const { user } = await openToday('2026-11-18', withTraining(services, { discardWorkout }));
    await user.click(await screen.findByRole('button', { name: 'Descartar sesión' }));

    await user.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(
      await screen.findByText('Esta sesión ya terminó y no se puede cambiar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sesión en curso' })).toBeInTheDocument();
  });
});

describe('Otra sesión de esta semana', () => {
  const links = () =>
    within(otherDays() ?? document.body)
      .getAllByRole('link')
      .map((a) => [a.textContent, a.getAttribute('href')]);

  it('AC-7: el sábado ofrece los tres días de pesas de la semana', async () => {
    await openToday('2026-11-21');

    expect(otherDays()).toBeInTheDocument();
    expect(links()).toEqual([
      ['Lun 16 · Full body A', '/dia/2026-11-16'],
      ['Mié 18 · Full body B', '/dia/2026-11-18'],
      ['Vie 20 · Full body A', '/dia/2026-11-20'],
    ]);
  });

  it('AC-9: el miércoles ofrece el lunes y el viernes, no hoy', async () => {
    await openToday('2026-11-18');

    expect(links()).toEqual([
      ['Lun 16 · Full body A', '/dia/2026-11-16'],
      ['Vie 20 · Full body A', '/dia/2026-11-20'],
    ]);
  });

  it('fuera del programa no aparece', async () => {
    await renderRoute('/', createTestServices({ clock: at('2026-11-15') }));
    await screen.findByText('El plan empieza el lunes 16 de noviembre.');

    expect(otherDays()).not.toBeInTheDocument();
  });
});
