import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { Block, PlannedItem, ProgramPosition, TodayPlan } from '@/modules/plan';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { AppContext } from '../context';
import { DayCard } from '../pages/today/DayCard';
import { closeTestDatabases, createTestServices } from './test-app';

// DayCard with a hand-built plan (spec 003 §6.2, AC-5): the real seed names its deload block
// "Descarga", so the deload chip is checked here with a block of another name.

const id = (s: string) => s as ID;

const block: Block = {
  id: id('b'),
  programId: id('p'),
  name: 'Bloque de prueba',
  startWeek: 1,
  endWeek: 1,
  targetRir: [4, 4],
  weekFactors: {},
  isDeload: true,
  schedule: [],
};

const position: ProgramPosition = {
  status: 'active',
  startDate: '2026-11-16' as LocalDate,
  totalWeeks: 1,
  week: 1,
  block,
  isDeloadWeek: true,
  volumeFactor: 0.5,
};

const item: PlannedItem = {
  exercise: {
    id: id('prensa'),
    name: 'Prensa de piernas',
    muscleGroup: 'quads',
    equipment: 'machine',
    metric: 'weight',
    lumbarRisk: 'low',
    isPrimary: true,
    restSeconds: [120, 180],
  },
  alternatives: [],
  order: 1,
  plannedSets: 1,
  repRange: [8, 12],
  targetRir: [4, 4],
};

const deloadDay: TodayPlan = {
  kind: 'workout',
  position,
  template: { id: id('t'), blockId: block.id, name: 'Push', items: [] },
  plannedItems: [item],
};

afterEach(closeTestDatabases);

// "Empezar sesión" needs the app services and a router.
function renderCard(today: TodayPlan, props: Partial<Parameters<typeof DayCard>[0]> = {}) {
  render(
    <AppContext value={createTestServices()}>
      <MemoryRouter>
        <DayCard today={today} date={'2026-11-16' as LocalDate} {...props} />
      </MemoryRouter>
    </AppContext>,
  );
}

describe('DayCard', () => {
  it('AC-5: en semana de descarga añade el chip "Descarga" al del bloque y al RIR', () => {
    renderCard(deloadDay);

    const region = screen.getByRole('region', { name: 'Tu sesión de hoy' });
    expect(
      within(region)
        .getAllByRole('listitem')
        .map((chip) => chip.textContent),
    ).toEqual(['Bloque de prueba', 'RIR 4', 'Descarga']);
    // 600 + 1 × (45 + 150) + 90 = 885 s → 15 min (Node)
    expect(within(region).getByText('1 ejercicio · ~15 min')).toBeInTheDocument();
  });

  it('fuera de la semana de descarga no hay chip "Descarga"', () => {
    const normal: TodayPlan = {
      ...deloadDay,
      position: { ...position, isDeloadWeek: false },
    };
    renderCard(normal);

    expect(screen.queryByText('Descarga')).not.toBeInTheDocument();
  });
});

// Spec 005b §6.1 (RN-TRN-27): another session was already closed today.
describe('DayCard con una sesión cerrada hoy', () => {
  const friday = { name: 'Full body A', plannedFor: '2026-11-20' as LocalDate };
  const TEXT = 'Ya entrenaste hoy (Full body A del viernes).';

  it('spec 005b AC-9: un día de pesas pendiente cambia "Empezar sesión" por el texto y conserva título, resumen y chips', () => {
    renderCard(deloadDay, { trained: friday });

    const region = screen.getByRole('region', { name: 'Tu sesión de hoy' });
    expect(within(region).getByText(TEXT)).toBeInTheDocument();
    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
    expect(within(region).getByRole('heading', { name: 'Push' })).toBeInTheDocument();
    expect(within(region).getByText('1 ejercicio · ~15 min')).toBeInTheDocument();
    expect(
      within(region)
        .getAllByRole('listitem')
        .map((chip) => chip.textContent),
    ).toEqual(['Bloque de prueba', 'RIR 4', 'Descarga']);
  });

  it('sin sesión cerrada hoy, "Empezar sesión" sigue y no hay texto', () => {
    renderCard(deloadDay, { trained: null });

    expect(screen.getByRole('button', { name: 'Empezar sesión' })).toBeInTheDocument();
    expect(screen.queryByText(/Ya entrenaste hoy/)).not.toBeInTheDocument();
  });

  it('spec 005b AC-8: un día de pesas ya hecho conserva su tarjeta, sin el texto', () => {
    // view null: broken data, the card shows no summary line (spec 005 plan §6.7).
    const now = '2026-11-16T19:00:00-06:00' as Instant;
    renderCard(deloadDay, { trained: friday, done: { workoutId: id('w'), view: null, now } });

    expect(screen.getByText('Hecha')).toBeInTheDocument();
    expect(screen.queryByText(/Ya entrenaste hoy/)).not.toBeInTheDocument();
  });

  it('spec 005b decisión 4: cardio, descanso y fuera del programa no cambian', () => {
    const days: TodayPlan[] = [
      { kind: 'cardio', position, note: 'Cardio suave 30-40 min' },
      { kind: 'rest', position },
      { kind: 'none', position: { ...position, status: 'finished' } },
    ];
    for (const day of days) {
      const { unmount } = render(
        <AppContext value={createTestServices()}>
          <MemoryRouter>
            <DayCard today={day} date={'2026-11-16' as LocalDate} trained={friday} />
          </MemoryRouter>
        </AppContext>,
      );
      expect(screen.queryByText(/Ya entrenaste hoy/)).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe('DayCard de un día hecho (spec 006 AC-33)', () => {
  it('spec 006 AC-33: "Ver detalle" lleva al detalle de su sesión, aunque no haya resumen', () => {
    renderCard(deloadDay, {
      done: { workoutId: id('w-hecho'), view: null, now: '2026-11-16T19:00:00-06:00' as Instant },
    });

    expect(screen.getByRole('link', { name: 'Ver detalle' })).toHaveAttribute(
      'href',
      '/historial/w-hecho',
    );
  });
});
