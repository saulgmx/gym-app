import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ID, LocalDate } from '@/shared/kernel';
import { OtherDays } from '../pages/today/OtherDays';

// "Otra sesión de esta semana" (spec 002 AC-7 to AC-11, spec 005 AC-32) with the notice of
// spec 005b §6.1 (RN-TRN-27): shown under the heading once a session was closed today; the rows
// do not change. Since spec 006 AC-34 a done row links to its session detail.

const NOTICE = 'Ya entrenaste hoy. Podrás empezar otra sesión mañana.';

const days = [
  { date: '2026-11-16' as LocalDate, name: 'Full body A', doneId: null },
  { date: '2026-11-20' as LocalDate, name: 'Full body A', doneId: 'w-vie' as ID },
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

  it('spec 005b AC-9: las filas no cambian con el aviso; spec 006 AC-34: la hecha enlaza a su detalle', () => {
    const region = renderDays(true);

    expect(within(region).getByRole('link', { name: 'Lun 16 · Full body A' })).toHaveAttribute(
      'href',
      '/dia/2026-11-16',
    );
    expect(within(region).getAllByRole('link')).toHaveLength(2);
    expect(
      within(region).getByRole('link', { name: 'Vie 20 · Full body A · hecha' }),
    ).toHaveAttribute('href', '/historial/w-vie');
  });

  it('sin sesión cerrada hoy no hay aviso', () => {
    const region = renderDays(false);

    expect(within(region).queryByText(NOTICE)).not.toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Lun 16 · Full body A' })).toBeInTheDocument();
  });
});
