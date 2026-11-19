import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/shared/kernel';
import { OtherDays } from '../pages/today/OtherDays';

// "Otra sesión de esta semana" (spec 002 AC-7 to AC-11, spec 005 AC-32) with the notice of
// spec 005b §6.1 (RN-TRN-27): shown under the heading once a session was closed today; the rows
// do not change.

const NOTICE = 'Ya entrenaste hoy. Podrás empezar otra sesión mañana.';

const days = [
  { date: '2026-11-16' as LocalDate, name: 'Full body A', done: false },
  { date: '2026-11-20' as LocalDate, name: 'Full body A', done: true },
];

function renderDays(trainedToday: boolean) {
  render(
    <MemoryRouter>
      <OtherDays days={days} trainedToday={trainedToday} />
    </MemoryRouter>,
  );
  return screen.getByRole('region', { name: 'Otra sesión de esta semana' });
}

describe('OtherDays', () => {
  it('spec 005b AC-8: con una sesión cerrada hoy, el aviso va justo debajo del título', () => {
    const region = renderDays(true);

    const notice = within(region).getByText(NOTICE);
    const heading = within(region).getByRole('heading', { name: 'Otra sesión de esta semana' });
    expect(heading.nextElementSibling).toBe(notice);
  });

  it('spec 005b AC-9: las filas no cambian: la pendiente sigue siendo un enlace a su vista previa y la hecha, texto', () => {
    const region = renderDays(true);

    expect(within(region).getByRole('link', { name: 'Lun 16 · Full body A' })).toHaveAttribute(
      'href',
      '/dia/2026-11-16',
    );
    expect(within(region).getAllByRole('link')).toHaveLength(1);
    expect(within(region).getByText(/Vie 20 · Full body A · hecha/)).toBeInTheDocument();
  });

  it('sin sesión cerrada hoy no hay aviso', () => {
    const region = renderDays(false);

    expect(within(region).queryByText(NOTICE)).not.toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Lun 16 · Full body A' })).toBeInTheDocument();
  });
});
