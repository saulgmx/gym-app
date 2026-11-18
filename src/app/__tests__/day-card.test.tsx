import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Block, PlannedItem, ProgramPosition, TodayPlan } from '@/modules/plan';
import type { ID, LocalDate } from '@/shared/kernel';
import { DayCard } from '../pages/today/DayCard';

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

describe('DayCard', () => {
  it('AC-5: en semana de descarga añade el chip "Descarga" al del bloque y al RIR', () => {
    render(<DayCard today={deloadDay} date={'2026-11-16' as LocalDate} canStart={false} />);

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
    render(<DayCard today={normal} date={'2026-11-16' as LocalDate} canStart={false} />);

    expect(screen.queryByText('Descarga')).not.toBeInTheDocument();
  });
});
