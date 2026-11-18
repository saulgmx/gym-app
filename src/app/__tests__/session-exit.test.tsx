import 'fake-indexeddb/auto';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrainingApi, TrainingError, Workout } from '@/modules/training';
import { err, fixedClock, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import { closeTestDatabases, createTestServices, renderRoute, tapToNavigate } from './test-app';

// The exit sheet of the session (spec 004 AC-12 to AC-18, §6.3; plan §6.8; T9) over the real
// seed. Full body A started on Monday 2026-11-16 at 18:00, with both sets of Prensa and the
// first of Press de banca done: 1 of 7 exercises done, 3 sets in 2 exercises.

const MONDAY = '2026-11-16' as LocalDate;
const STARTED = fixedClock('2026-11-16T18:00:00-06:00');

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

async function doneSet(training: TrainingApi, workout: Workout, order: number, setNumber: number) {
  const view = await training.getWorkoutView(workout.id);
  const exerciseId = workout.items.find((i) => i.order === order)?.exerciseId;
  const set = view?.sets.find((s) => s.exerciseId === exerciseId && s.setNumber === setNumber);
  if (!set) throw new Error(`No set ${String(setNumber)} in item ${String(order)}`);
  await training.logSet(set.id, { weightKg: 60, reps: 10, rir: 3 });
  const marked = await training.toggleSetDone(set.id);
  if (!marked.ok) throw new Error(marked.error.code);
}

async function example(pageClock = '2026-11-16T18:18:42-06:00') {
  const services = createTestServices({ seedClock: STARTED, clock: fixedClock(pageClock) });
  await services.ready;
  const result = await services.training.startWorkout(MONDAY);
  if (!result.ok) throw new Error(result.error.code);
  const workout = result.value;
  await doneSet(services.training, workout, 1, 1);
  await doneSet(services.training, workout, 1, 2);
  await doneSet(services.training, workout, 2, 1);
  return { services, workout };
}

async function openExit(services: AppServices, workout: Workout) {
  const router = await renderRoute(`/sesion/${workout.id}/2`, services);
  const user = userEvent.setup();
  await screen.findByRole('heading', { level: 1 });
  await user.click(arrow());
  return { router, user };
}

const arrow = () => screen.getByRole('button', { name: 'Salir de la sesión' });
const exitSheet = () => screen.getByRole('dialog', { name: '¿Salir de la sesión?' });
const confirmation = () => screen.getByRole('dialog', { name: '¿Descartar la sesión?' });
const keepTraining = () => within(exitSheet()).getByRole('button', { name: 'Seguir entrenando' });
const discardOption = () => within(exitSheet()).getByRole('button', { name: /^Descartar sesión/ });

function withTraining(services: AppServices, overrides: Partial<TrainingApi>): AppServices {
  return { ...services, training: { ...services.training, ...overrides } };
}

describe('el aviso de salida', () => {
  it('AC-12: título, texto con el avance y el tiempo, y tres opciones en orden', async () => {
    const { services, workout } = await example();
    await openExit(services, workout);

    expect(exitSheet()).toHaveAccessibleDescription(
      'Llevas 1 de 7 ejercicios y 18:42 de entrenamiento.',
    );
    // Each option found by its accessible name, and the three of them in this order.
    const leave = within(exitSheet()).getByRole('link', { name: /^Salir y continuar después/ });
    expect([...exitSheet().querySelectorAll('a, button')]).toEqual([
      keepTraining(),
      leave,
      discardOption(),
    ]);
    expect(screen.queryByText(/Terminar y guardar/)).not.toBeInTheDocument();
  });

  it('AC-12, AC-35: el nombre de cada opción es todo su texto visible (WCAG 2.5.3)', async () => {
    const { services, workout } = await example();
    await openExit(services, workout);

    const leave = within(exitSheet()).getByRole('link', { name: /^Salir y continuar después/ });
    expect(leave).toHaveAttribute('href', '/');
    expect(leave).toHaveAccessibleName('Salir y continuar después Hoy mostrará "Continuar sesión"');
    expect(discardOption()).toHaveAccessibleName(
      'Descartar sesión Las series no contarán en tu historial',
    );
    expect(leave).not.toHaveAttribute('aria-describedby');
  });

  it('al abrir, el foco va a "Seguir entrenando"', async () => {
    const { services, workout } = await example();
    await openExit(services, workout);
    expect(keepTraining()).toHaveFocus();
  });

  it('AC-18: en una sesión de otro día, el texto no lleva el tiempo', async () => {
    const { services, workout } = await example('2026-11-17T09:00:00-06:00');
    await openExit(services, workout);

    expect(exitSheet()).toHaveAccessibleDescription('Llevas 1 de 7 ejercicios.');
  });

  it('AC-13: "Seguir entrenando" cierra, sigo en el ejercicio y el foco vuelve a la flecha', async () => {
    const { services, workout } = await example();
    const { router, user } = await openExit(services, workout);

    await user.click(keepTraining());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/2`);
    expect(arrow()).toHaveFocus();
  });

  it('AC-13: Escape cierra igual que "Seguir entrenando"', async () => {
    const { services, workout } = await example();
    await openExit(services, workout);

    fireEvent(exitSheet(), new Event('cancel', { cancelable: true }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(arrow()).toHaveFocus();
  });

  it('AC-13: tocar el fondo cierra igual que "Seguir entrenando"', async () => {
    const { services, workout } = await example();
    const { user } = await openExit(services, workout);

    await user.click(exitSheet());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC-14: "Salir y continuar después" va a "Hoy" sin tocar la sesión ni sus series', async () => {
    const { services, workout } = await example();
    const before = await services.training.getWorkoutView(workout.id);
    const { router, user } = await openExit(services, workout);

    await tapToNavigate(
      user,
      within(exitSheet()).getByRole('link', { name: /^Salir y continuar después/ }),
    );

    expect(router.state.location.pathname).toBe('/');
    expect(router.state.historyAction).toBe('PUSH');
    const after = await services.training.getWorkoutView(workout.id);
    expect(after?.workout.status).toBe('in_progress');
    expect(after?.sets).toEqual(before?.sets);
  });
});

describe('descartar desde el aviso', () => {
  it('AC-15: "Descartar sesión" cambia el aviso por la confirmación con los textos de spec 003', async () => {
    const { services, workout } = await example();
    const { user } = await openExit(services, workout);

    await user.click(discardOption());

    expect(screen.queryByRole('dialog', { name: '¿Salir de la sesión?' })).not.toBeInTheDocument();
    expect(confirmation()).toHaveAccessibleDescription(
      'Las 3 series que registraste en 2 ejercicios no contarán en tu historial. No se puede deshacer.',
    );
    expect(within(confirmation()).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(within(confirmation()).getByRole('button', { name: 'Sí, descartar' })).toBeVisible();
  });

  it('AC-16: "Cancelar" vuelve al aviso de salida, con el foco en "Seguir entrenando"', async () => {
    const { services, workout } = await example();
    const { user } = await openExit(services, workout);
    await user.click(discardOption());

    await user.click(within(confirmation()).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog', { name: '¿Descartar la sesión?' })).not.toBeInTheDocument();
    expect(exitSheet()).toBeVisible();
    await waitFor(() => {
      expect(keepTraining()).toHaveFocus();
    });
    expect((await services.training.getWorkout(workout.id))?.status).toBe('in_progress');
  });

  it('AC-16: Escape en la confirmación también vuelve al aviso', async () => {
    const { services, workout } = await example();
    const { user } = await openExit(services, workout);
    await user.click(discardOption());

    fireEvent(confirmation(), new Event('cancel', { cancelable: true }));

    expect(exitSheet()).toBeVisible();
  });

  it('AC-16: tocar el fondo de la confirmación también vuelve al aviso', async () => {
    const { services, workout } = await example();
    const { user } = await openExit(services, workout);
    await user.click(discardOption());

    await user.click(confirmation());

    expect(exitSheet()).toBeVisible();
  });

  it('AC-17: "Sí, descartar" deja el workout descartado con sus series y vuelve a "Hoy" con replace', async () => {
    const { services, workout } = await example();
    const { router, user } = await openExit(services, workout);
    await user.click(discardOption());

    await user.click(within(confirmation()).getByRole('button', { name: 'Sí, descartar' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(router.state.historyAction).toBe('REPLACE');
    const view = await services.training.getWorkoutView(workout.id);
    expect(view?.workout.status).toBe('discarded');
    expect(view?.sets.filter((s) => s.done)).toHaveLength(3); // RN-TRN-15: nothing is deleted
  });

  it('si descartar falla, todo se cierra, la sesión sigue y el motivo aparece en la tarjeta', async () => {
    const { services, workout } = await example();
    const discardWorkout = () =>
      Promise.resolve(err<TrainingError>({ code: 'training/workout-closed', message: 'closed' }));
    const failing = withTraining(services, { discardWorkout });
    const { router, user } = await openExit(failing, workout);
    await user.click(discardOption());

    await user.click(within(confirmation()).getByRole('button', { name: 'Sí, descartar' }));

    expect(await screen.findByText('Esta sesión ya terminó y no se puede cambiar.')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/2`);
  });
});
