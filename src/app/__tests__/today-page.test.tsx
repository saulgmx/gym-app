import 'fake-indexeddb/auto';
import { act, screen, within } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixedClock, type Clock, type LocalDate } from '@/shared/kernel';
import { AppContext } from '../context';
import { GENERIC_ERROR_MESSAGE } from '../errors/messages';
import { routes } from '../router';
import planSeed from '../seed/plan-seed.json';
import {
  closeTestDatabases,
  createTestServices,
  renderRoute,
  renderRouteWhileLoading,
} from './test-app';

// "Hoy" with the real seed (spec 001 AC-15 to AC-21, plan §6.11). The plan starts on Monday
// 2026-11-16; dates checked with Node: 2026-11-17 Tuesday, 18 Wednesday, 19 Thursday;
// 2027-02-22 is the Monday of week 15 and 2027-03-01 the day after the program.

const at = (day: string) => fixedClock(`${day}T08:00:00-06:00`);

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

async function openToday(clock: Clock = at('2026-11-18')) {
  await renderRoute('/', createTestServices({ clock }));
  expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
}

// The day card comes first; "Otra sesión de esta semana" (spec 002) adds a second h2 below it.
function card(): HTMLElement {
  const [heading] = screen.getAllByRole('heading', { level: 2 });
  const section = heading?.closest('section');
  if (!section) throw new Error('The day heading is inside a section');
  return section;
}

describe('TodayPage', () => {
  it('AC-15: día de pesas con encabezado, sesión y ejercicios en orden', async () => {
    await openToday();

    expect(await screen.findByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
    expect(screen.getByText('Miércoles 18 de noviembre')).toBeInTheDocument();
    expect(screen.getByText('Bloque 1 · Full body')).toBeInTheDocument();
    expect(screen.getByText('Semana 1 de 15')).toBeInTheDocument();

    const exercises = within(card()).getAllByRole('listitem');
    expect(exercises).toHaveLength(7);
    const [first] = exercises;
    expect(first).toHaveTextContent('Hack squat');
    expect(first).toHaveTextContent('2 × 8-12'); // 3 sets × 0.7 in week 1
    expect(first).toHaveTextContent('Con prensa: pies bajos. Faja solo si la carga es pesada');
  });

  it('spec 003 plan §6.11: el RIR aparece una vez en la tarjeta, no en cada ejercicio', async () => {
    await openToday();

    await screen.findByRole('heading', { level: 2, name: 'Full body B' });
    expect(within(card()).getAllByText(/RIR/)).toHaveLength(1);
    expect(within(card()).getByText('RIR 3-4')).toBeVisible();
    for (const exercise of within(card()).getAllByRole('listitem')) {
      expect(exercise).not.toHaveTextContent('RIR');
    }
  });

  it('AC-16: día de cardio con su nota y sin lista de ejercicios', async () => {
    await openToday(at('2026-11-17'));

    expect(await screen.findByRole('heading', { level: 2, name: 'Cardio' })).toBeVisible();
    expect(
      screen.getByText('Cardio suave 30-40 min (bici, elíptica o caminata inclinada)'),
    ).toBeInTheDocument();
    expect(within(card()).queryByRole('list')).not.toBeInTheDocument();
  });

  it('AC-16: día de descanso con su texto y sin lista de ejercicios', async () => {
    await openToday(at('2026-11-19'));

    expect(await screen.findByRole('heading', { level: 2, name: 'Descanso' })).toBeVisible();
    expect(
      screen.getByText('Recupera: dormir y comer bien también es entrenar.'),
    ).toBeInTheDocument();
    expect(within(card()).queryByRole('list')).not.toBeInTheDocument();
  });

  it('AC-17, spec 003 AC-12: la tira de la semana marca hoy', async () => {
    await openToday();

    const strip = await screen.findByRole('list', { name: 'Semana' });
    const days = within(strip).getAllByRole('img');
    expect(days).toHaveLength(7);
    expect(days[2]).toHaveAccessibleName('miércoles, hoy, Full body B, pendiente');
    expect(days[0]).toHaveAccessibleName('lunes, Full body A, no hecha');
  });

  it('AC-18: semana de descarga', async () => {
    await openToday(at('2027-02-22'));

    expect(await screen.findByRole('heading', { level: 2, name: 'Push' })).toBeVisible();
    expect(screen.getByText('Descarga')).toBeInTheDocument();
    expect(screen.getByText('Semana 15 de 15 · Semana de descarga')).toBeInTheDocument();
  });

  it('AC-19: antes del inicio, solo el mensaje, sin tira ni lista', async () => {
    await openToday(at('2026-11-15'));

    expect(await screen.findByText('El plan empieza el lunes 16 de noviembre.')).toBeVisible();
    expect(screen.getByText('Domingo 15 de noviembre')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Semana' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('AC-19: al terminar, solo el mensaje, sin tira ni lista', async () => {
    await openToday(at('2027-03-01'));

    expect(await screen.findByText('Terminaste el plan de 15 semanas.')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Semana' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  describe('AC-20: al volver a primer plano otro día', () => {
    function changingClock(first: string) {
      let today = first as LocalDate;
      const clock: Clock = { now: () => `${today}T08:00:00-06:00` as never, today: () => today };
      return {
        clock,
        set: (day: string) => {
          today = day as LocalDate;
        },
      };
    }

    function becomeVisible(state: 'visible' | 'hidden') {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }

    it('muestra el día nuevo sin recargar', async () => {
      const { clock, set } = changingClock('2026-11-18');
      await openToday(clock);
      await screen.findByRole('heading', { level: 2, name: 'Full body B' });

      set('2026-11-19');
      becomeVisible('visible');

      expect(await screen.findByRole('heading', { level: 2, name: 'Descanso' })).toBeVisible();
      expect(screen.getByText('Jueves 19 de noviembre')).toBeInTheDocument();
    });

    it('no cambia mientras la app sigue oculta', async () => {
      const { clock, set } = changingClock('2026-11-18');
      await openToday(clock);
      await screen.findByRole('heading', { level: 2, name: 'Full body B' });

      set('2026-11-19');
      becomeVisible('hidden');

      expect(screen.getByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
    });
  });

  describe('AC-21: errores de arranque', () => {
    it('seed inválido → aviso genérico, nunca el estado vacío ni una lista', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs the error
      await renderRoute('/', createTestServices({ seed: {} }));

      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.queryByText(/Aún no hay/)).not.toBeInTheDocument();
    });
  });

  it('primer arranque: espera a ready y nunca consulta la base antes de que tenga el plan', async () => {
    // An empty database (the invalid seed writes nothing) and a `ready` that settles only after
    // the real seed is written, as on the very first start. The page is mounted with createRoot,
    // as bootstrap does, and outside the act() environment: inside it React never retries a page
    // suspended on a promise that settles later.
    const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean | undefined };
    const previous = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    try {
      const { plan, training, clock } = createTestServices({ seed: {} });
      let markReady: () => void = () => undefined;
      const ready = new Promise<void>((resolve) => {
        markReady = resolve;
      });
      root.render(
        <AppContext value={{ plan, training, clock, ready }}>
          <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />
        </AppContext>,
      );

      // Long enough for a page that does not wait for `ready` to query the empty database.
      await new Promise((resolve) => setTimeout(resolve, 50));
      await plan.ensureSeeded(planSeed);
      markReady();

      expect(await screen.findByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      root.unmount();
      container.remove();
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });

  it('mientras carga, solo el título: sin estado vacío ni datos a medias', () => {
    const services = { ...createTestServices(), ready: new Promise<void>(() => undefined) };
    renderRouteWhileLoading('/', services);

    expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(screen.queryByText(/Semana|Aún no hay/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });
});
