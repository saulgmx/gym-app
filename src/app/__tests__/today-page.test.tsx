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

// The day card is a region named by its eyebrow (spec 003 §6.2).
const card = () => screen.getByRole('region', { name: 'Tu sesión de hoy' });
const chipsOf = (region: HTMLElement) =>
  within(region)
    .queryAllByRole('listitem')
    .map((chip) => chip.textContent);
const details = () => screen.queryByText(/^Ver (los \d+ ejercicios|el ejercicio)$/);

describe('TodayPage', () => {
  it('spec 003 §6.1: el h1 "Hoy" sigue en la página, oculto a la vista', async () => {
    await openToday();
    await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toHaveClass('visually-hidden');
  });

  it('AC-1: lunes 16, fila superior y tarjeta de Full body A con resumen, chips y CTA', async () => {
    await openToday(at('2026-11-16'));

    const region = await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(screen.getByText('Lunes 16 nov')).toBeInTheDocument();
    expect(screen.getByText('Semana 1 de 15')).toBeInTheDocument();
    expect(within(region).getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();
    expect(within(region).getByText('7 ejercicios · ~50 min')).toBeVisible();
    expect(chipsOf(region)).toEqual(['Bloque 1 · Full body', 'RIR 3-4']);
    expect(within(region).getByRole('button', { name: 'Empezar sesión' })).toBeVisible();
  });

  it('AC-3: "Ver los 7 ejercicios" cerrado; dentro, series × reps y la nota, sin cargas', async () => {
    await openToday(at('2026-11-16'));
    await screen.findByRole('region', { name: 'Tu sesión de hoy' });

    const summary = screen.getByText('Ver los 7 ejercicios');
    const box = summary.closest('details');
    if (!box) throw new Error('The summary is inside a details');
    expect(box).not.toHaveAttribute('open');
    expect(box.parentElement).not.toBe(card()); // below the card, not inside it
    const exercises = within(box).getAllByRole('listitem');
    expect(exercises).toHaveLength(7);
    expect(exercises[0]).toHaveTextContent('Prensa de piernas');
    expect(exercises[0]).toHaveTextContent('2 × 8-12');
    expect(exercises[0]).toHaveTextContent('Pelvis pegada al respaldo, sin despegar la lumbar');
    expect(box).not.toHaveTextContent(/kg/);
  });

  it('AC-4: un ejercicio de tiempo muestra las reps en segundos (Lower, sábado 23-ene-2027)', async () => {
    await openToday(at('2027-01-23'));
    await screen.findByRole('heading', { level: 2, name: 'Lower' });

    const plancha = screen
      .getAllByRole('listitem')
      .find((item) => item.textContent.startsWith('Plancha'));
    expect(plancha).toHaveTextContent('3 × 30-45 s');
  });

  it('AC-6: miércoles 18 (Full body B, semana 1) → ~55 min', async () => {
    await openToday(at('2026-11-18'));

    const region = await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
    expect(within(region).getByText('7 ejercicios · ~55 min')).toBeVisible();
  });

  it('AC-6: lunes 23 (Full body B, semana 2, factor 1) → ~75 min y RIR 2-3', async () => {
    await openToday(at('2026-11-23'));

    const region = await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
    expect(within(region).getByText('7 ejercicios · ~75 min')).toBeVisible();
    expect(chipsOf(region)).toEqual(['Bloque 1 · Full body', 'RIR 2-3']);
    expect(screen.getByText('Semana 2 de 15')).toBeInTheDocument();
  });

  it('AC-5: semana 15 (deload): "Descarga" una vez, "RIR 4" y la duración al 50%', async () => {
    await openToday(at('2027-02-22'));

    const region = await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Push' })).toBeVisible();
    // The deload block is named "Descarga": one chip, not two.
    expect(chipsOf(region)).toEqual(['Descarga', 'RIR 4']);
    expect(within(region).getByText('7 ejercicios · ~55 min')).toBeVisible();
    expect(screen.getByText('Semana 15 de 15')).toBeInTheDocument();
  });

  it('AC-7: martes 17 (cardio): eyebrow, "Cardio", la nota y solo el chip del bloque', async () => {
    await openToday(at('2026-11-17'));

    const region = await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Cardio' })).toBeVisible();
    expect(
      within(region).getByText('Cardio suave 30-40 min (bici, elíptica o caminata inclinada)'),
    ).toBeVisible();
    expect(chipsOf(region)).toEqual(['Bloque 1 · Full body']);
    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
    expect(details()).not.toBeInTheDocument();
  });

  it('AC-8: jueves 19 (descanso): "Descanso", el texto fijo y solo el chip del bloque', async () => {
    await openToday(at('2026-11-19'));

    const region = await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Descanso' })).toBeVisible();
    expect(
      within(region).getByText('Recupera: dormir y comer bien también es entrenar.'),
    ).toBeVisible();
    expect(chipsOf(region)).toEqual(['Bloque 1 · Full body']);
    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
    expect(details()).not.toBeInTheDocument();
  });

  it('AC-9: antes del programa (domingo 15), solo la fecha y el mensaje; sin tira ni otros días', async () => {
    await openToday(at('2026-11-15'));

    const region = await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(within(region).getByText('El plan empieza el lunes 16 de noviembre.')).toBeVisible();
    expect(screen.getByText('Domingo 15 nov')).toBeInTheDocument();
    expect(screen.queryByText(/^Semana \d+ de/)).not.toBeInTheDocument();
    expect(within(region).queryByRole('heading')).not.toBeInTheDocument();
    expect(chipsOf(region)).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Esta semana' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Otra sesión de esta semana' }),
    ).not.toBeInTheDocument();
  });

  it('AC-9: después del programa (lunes 1-mar-2027), el mensaje de fin', async () => {
    await openToday(at('2027-03-01'));

    const region = await screen.findByRole('region', { name: 'Tu sesión de hoy' });
    expect(within(region).getByText('Terminaste el plan de 15 semanas.')).toBeVisible();
    expect(screen.queryByText(/^Semana \d+ de/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Esta semana' })).not.toBeInTheDocument();
  });

  it('AC-10: "Esta semana" con "0 de 3 sesiones" y la tira debajo de la tarjeta', async () => {
    await openToday(at('2026-11-18'));

    const week = await screen.findByRole('region', { name: 'Esta semana' });
    expect(within(week).getByRole('heading', { level: 2, name: 'Esta semana' })).toBeVisible();
    expect(within(week).getByText('0 de 3 sesiones')).toBeVisible();
    const days = within(within(week).getByRole('list', { name: 'Semana' })).getAllByRole('img');
    expect(days).toHaveLength(7);
    expect(days[2]).toHaveAccessibleName('miércoles, hoy, Full body B, pendiente');
    expect(days[0]).toHaveAccessibleName('lunes, Full body A, no hecha');
    expect(card().compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
      expect(screen.getByText('Jueves 19 nov')).toBeInTheDocument();
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
      const { plan, training, health, data, clock } = createTestServices({ seed: {} });
      let markReady: () => void = () => undefined;
      const ready = new Promise<void>((resolve) => {
        markReady = resolve;
      });
      root.render(
        <AppContext value={{ plan, training, health, data, clock, ready }}>
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
