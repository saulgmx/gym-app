import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalDate } from '@/shared/kernel';
import { AppContext, type AppServices } from '../context';
import { AppErrorBoundary } from '../errors/AppErrorBoundary';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { closeTestDatabases, createTestServices } from './test-app';

// Spec 000 AC-32 and plan §6.12, spec 002 AC-37 (plan §6.8) and spec 005 AC-50 (plan §7.1): no
// prompt during an active session. The vite-plugin-pwa virtual module is simulated; training and
// health are the real modules.

const sw = vi.hoisted(() => ({
  waiting: false,
  updateServiceWorker: vi.fn<(reloadPage?: boolean) => Promise<void>>(),
}));

vi.mock('virtual:pwa-register/react', async () => {
  const { useState } = await import('react');
  return {
    useRegisterSW: () => ({
      needRefresh: useState(sw.waiting),
      offlineReady: useState(false),
      updateServiceWorker: sw.updateServiceWorker,
    }),
  };
});

beforeEach(() => {
  sw.waiting = false;
  sw.updateServiceWorker.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

function renderPrompt(services: AppServices = createTestServices()) {
  // As in bootstrap: an error that escapes would replace the whole app with the fallback.
  render(
    <AppErrorBoundary>
      <AppContext value={services}>
        <UpdatePrompt />
        <p>Resto de la app</p>
      </AppContext>
    </AppErrorBoundary>,
  );
  return services;
}

const prompt = () => screen.queryByText('Hay una versión nueva.');

/** Lets the active-session query answer, so an absent prompt is not just still loading. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('UpdatePrompt', () => {
  it('shows nothing while no new version is waiting', async () => {
    renderPrompt();
    await settle();
    expect(prompt()).not.toBeInTheDocument();
  });

  it('AC-32: announces a waiting version without reloading on its own', async () => {
    sw.waiting = true;
    renderPrompt();
    await settle(); // still there once the active-session query answers

    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva.');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeInTheDocument();
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('AC-32: Actualizar activates the new version and reloads', async () => {
    sw.waiting = true;
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Actualizar' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('Ahora no hides the prompt without updating', async () => {
    sw.waiting = true;
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Ahora no' }));

    expect(prompt()).not.toBeInTheDocument();
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();
  });
});

describe('AC-37: aplazado durante una sesión activa', () => {
  async function withActiveSession() {
    const services = createTestServices();
    await services.ready;
    const result = await services.training.startWorkout('2026-11-18' as LocalDate);
    if (!result.ok) throw new Error(result.error.code);
    return { services, workout: result.value };
  }

  it('con una sesión activa no aparece, y aparece al descartarla', async () => {
    sw.waiting = true;
    const { services, workout } = await withActiveSession();
    renderPrompt(services);
    await settle();
    expect(prompt()).not.toBeInTheDocument();

    await services.training.discardWorkout(workout.id);

    expect(await screen.findByText('Hay una versión nueva.')).toBeInTheDocument();
  });

  it('spec 005 AC-50: con una sesión activa no aparece, y aparece al cerrarla', async () => {
    sw.waiting = true;
    const { services, workout } = await withActiveSession();
    renderPrompt(services);
    await settle();
    expect(prompt()).not.toBeInTheDocument();

    // What the Cierre does (plan §5): a done set (RN-TRN-22), the pain, then finishWorkout.
    const view = await services.training.getWorkoutView(workout.id);
    const [set] = view?.sets ?? [];
    if (!view || !set) throw new Error('No sets in the workout');
    const weighted = view.exercises[set.exerciseId]?.metric === 'weight';
    await services.training.logSet(
      set.id,
      weighted ? { weightKg: 60, reps: 10, rir: 3 } : { reps: 10, rir: 3 },
    );
    const marked = await services.training.toggleSetDone(set.id);
    if (!marked.ok) throw new Error(marked.error.code);
    const pain = await services.health.recordPain(workout.id, {
      level: 2,
      redFlags: [],
      date: workout.date,
    });
    if (!pain.ok) throw new Error(pain.error.code);
    await settle();
    expect(prompt()).not.toBeInTheDocument(); // still in_progress until finishWorkout

    const finished = await services.training.finishWorkout(workout.id, {});
    if (!finished.ok) throw new Error(finished.error.code);

    expect(await screen.findByText('Hay una versión nueva.')).toBeInTheDocument();
  });

  it('mientras se consulta la sesión activa no aparece', async () => {
    sw.waiting = true;
    const services = createTestServices();
    renderPrompt({
      ...services,
      training: { ...services.training, getActiveWorkout: () => new Promise(() => undefined) },
    });
    await settle();

    expect(prompt()).not.toBeInTheDocument();
  });

  it('si la consulta falla, no muestra nada y el resto de la app sigue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs caught errors
    sw.waiting = true;
    const services = createTestServices();
    renderPrompt({
      ...services,
      training: {
        ...services.training,
        getActiveWorkout: () => Promise.reject(new Error('disk failure')),
      },
    });
    await settle();

    expect(prompt()).not.toBeInTheDocument();
    expect(screen.getByText('Resto de la app')).toBeInTheDocument();
  });
});
