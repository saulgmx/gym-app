import 'fake-indexeddb/auto';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { TrainingApi, Workout } from '@/modules/training';
import { fixedClock, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import { closeTestDatabases, createTestServices, renderRoute, tapToNavigate } from './test-app';

// "Hoy" in state D2, with the real seed (spec 003 §4.5, §6.3; AC-16, AC-18 to AC-22, AC-25). The
// example of the spec: Full body A started on Monday 2026-11-16 at 18:00; "Hoy" opened at
// 18:18:42. Remaining times computed with Node (RN-TRN-20): 2280 s → 40 min, 1605 s → 25 min.

const STARTED = fixedClock('2026-11-16T18:00:00-06:00'); // training stamps startedAt with it
const LOOKED = fixedClock('2026-11-16T18:18:42-06:00');

afterEach(closeTestDatabases);

async function startMonday(clock = LOOKED) {
  const services = createTestServices({ clock, seedClock: STARTED });
  await services.ready;
  const started = await services.training.startWorkout('2026-11-16' as LocalDate);
  if (!started.ok) throw new Error(started.error.code);
  return { services, workout: started.value };
}

/** Marks [item index from 0, setNumber] pairs as done, with valid values (RN-TRN-05). */
async function markDone(training: TrainingApi, workout: Workout, sets: [number, number][]) {
  for (const [index, setNumber] of sets) {
    const view = await training.getWorkoutView(workout.id);
    const exerciseId = workout.items[index]?.exerciseId;
    const set = view?.sets.find((s) => s.exerciseId === exerciseId && s.setNumber === setNumber);
    if (!view || !set) throw new Error(`No set ${String(setNumber)} of item ${String(index + 1)}`);
    const weighted = view.exercises[set.exerciseId]?.metric === 'weight';
    await training.logSet(set.id, weighted ? { weightKg: 60, reps: 10 } : { reps: 10 });
    const marked = await training.toggleSetDone(set.id);
    if (!marked.ok) throw new Error(marked.error.code);
  }
}

/** Every set of the workout, done. */
async function markAll(training: TrainingApi, workout: Workout) {
  const view = await training.getWorkoutView(workout.id);
  const pairs = (view?.sets ?? []).map((s): [number, number] => [
    workout.items.findIndex((i) => i.exerciseId === s.exerciseId),
    s.setNumber,
  ]);
  await markDone(training, workout, pairs);
}

async function openToday(services: AppServices) {
  const router = await renderRoute('/', services);
  const card = await screen.findByRole('region', { name: 'Sesión en curso' });
  return { router, card, user: userEvent.setup() };
}

const segments = (card: HTMLElement) =>
  [...card.querySelectorAll('[data-state]')].map((s) => s.getAttribute('data-state'));

describe('Estado D2: sesión en curso', () => {
  it('AC-16: el ejemplo de la spec, con tiempo, avance, barra y "Vas en"', async () => {
    const { services, workout } = await startMonday();
    await markDone(services.training, workout, [
      [0, 1],
      [0, 2],
      [1, 1],
    ]);
    const { card } = await openToday(services);

    expect(within(card).getByText('18:42')).toBeInTheDocument();
    expect(within(card).getByText('Tiempo transcurrido:', { exact: false })).toHaveClass(
      'visually-hidden',
    );
    expect(within(card).getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();
    expect(within(card).getByText('1 de 7 ejercicios hechos')).toBeVisible();
    expect(within(card).getByText('Faltan ~25 min')).toBeVisible();
    expect(segments(card)).toEqual([
      'done',
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
    expect(card.querySelector('[data-state]')?.parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(within(card).getByText('Vas en: Press de banca con barra · serie 2')).toBeVisible();
    expect(within(card).getByRole('link', { name: 'Continuar sesión' })).toBeVisible();
    expect(within(card).getByRole('button', { name: 'Descartar sesión' })).toBeVisible();
  });

  it('AC-16, §6.3: sin la tarjeta del día, el desplegable ni "Otra sesión"; la tira sigue', async () => {
    const { services } = await startMonday();
    await openToday(services);

    expect(screen.queryByRole('region', { name: 'Tu sesión de hoy' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Ver los \d+ ejercicios$/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Otra sesión de esta semana' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Esta semana' })).toBeInTheDocument();
    expect(screen.getByText('Lunes 16 nov')).toBeInTheDocument();
  });

  it('AC-16: el nombre de la región no incluye el tiempo', async () => {
    const { services } = await startMonday();
    const { card } = await openToday(services);
    expect(card).toHaveAccessibleName('Sesión en curso');
    expect(card).not.toHaveAttribute('aria-live');
  });

  it('AC-18: "Continuar sesión" abre el ejercicio de "Vas en"', async () => {
    const { services, workout } = await startMonday();
    await markDone(services.training, workout, [
      [0, 1],
      [0, 2],
      [1, 1],
    ]);
    const { card, router, user } = await openToday(services);

    const link = within(card).getByRole('link', { name: 'Continuar sesión' });
    expect(link).toHaveAttribute('href', `/sesion/${workout.id}/2`);
    await tapToNavigate(user, link);
    expect(router.state.location.pathname).toBe(`/sesion/${workout.id}/2`);
  });

  it('AC-19: una sesión del lunes vista el martes, sin tiempo y con la fecha en el botón', async () => {
    const { services } = await startMonday(fixedClock('2026-11-17T09:00:00-06:00'));
    const { card } = await openToday(services);

    expect(within(card).queryByText(/^\d+:\d{2}(:\d{2})?$/)).not.toBeInTheDocument();
    expect(within(card).queryByText('Tiempo transcurrido:', { exact: false })).toBeNull();
    expect(
      within(card).getByRole('link', { name: 'Continuar sesión del lunes 16 de noviembre' }),
    ).toBeVisible();
  });

  it('AC-20: todo hecho → "7 de 7", los 7 segmentos hechos, sin "Faltan" ni "Vas en"', async () => {
    const { services, workout } = await startMonday();
    await markAll(services.training, workout);
    const { card } = await openToday(services);

    expect(within(card).getByText('7 de 7 ejercicios hechos')).toBeVisible();
    expect(segments(card)).toEqual(Array(7).fill('done'));
    expect(within(card).queryByText(/^Faltan/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/^Vas en/)).not.toBeInTheDocument();
    // Nothing left: the session page picks the last exercise (spec 002 AC-27).
    expect(within(card).getByRole('link', { name: 'Continuar sesión' })).toHaveAttribute(
      'href',
      `/sesion/${workout.id}`,
    );
  });

  it('AC-21: recién iniciada → "0 de 7", "Faltan ~40 min" y "Vas en: Prensa de piernas · serie 1"', async () => {
    const { services } = await startMonday();
    const { card } = await openToday(services);

    expect(within(card).getByText('0 de 7 ejercicios hechos')).toBeVisible();
    expect(within(card).getByText('Faltan ~40 min')).toBeVisible();
    expect(segments(card)[0]).toBe('current');
    expect(within(card).getByText('Vas en: Prensa de piernas · serie 1')).toBeVisible();
  });

  it('AC-22: una serie extra sin hacer en Prensa la deja pendiente ("serie 3")', async () => {
    const { services, workout } = await startMonday();
    await markDone(services.training, workout, [
      [0, 1],
      [0, 2],
      [1, 1],
    ]);
    const prensa = workout.items[0]?.exerciseId;
    if (!prensa) throw new Error('No Prensa');
    const extra = await services.training.addExtraSet(workout.id, prensa);
    if (!extra.ok) throw new Error(extra.error.code);
    const { card } = await openToday(services);

    expect(within(card).getByText('0 de 7 ejercicios hechos')).toBeVisible();
    expect(within(card).getByText('Vas en: Prensa de piernas · serie 3')).toBeVisible();
  });

  it('§7: el avance se recalcula en vivo al marcar una serie', async () => {
    const { services, workout } = await startMonday();
    const { card } = await openToday(services);
    expect(within(card).getByText('Vas en: Prensa de piernas · serie 1')).toBeVisible();

    await markDone(services.training, workout, [[0, 1]]);

    await waitFor(() => {
      expect(within(card).getByText('Vas en: Prensa de piernas · serie 2')).toBeVisible();
    });
  });

  it('AC-25: descartar vuelve al estado D', async () => {
    const { services, workout } = await startMonday();
    const { card, user } = await openToday(services);

    await user.click(within(card).getByRole('button', { name: 'Descartar sesión' }));
    await user.click(screen.getByRole('button', { name: 'Sí, descartar' }));

    const today = await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(within(today).getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Sesión en curso' })).not.toBeInTheDocument();
    expect((await services.training.getWorkout(workout.id))?.status).toBe('discarded');
  });

  it('§7: una sesión en curso fuera del programa se ve igual, sin la tira', async () => {
    const { services } = await startMonday(fixedClock('2027-03-01T09:00:00-06:00'));
    const { card } = await openToday(services);

    expect(within(card).getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Esta semana' })).not.toBeInTheDocument();
  });
});
