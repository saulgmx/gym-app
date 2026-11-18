import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeTestDatabases, renderRoute } from './test-app';

// Spec 000 AC-22, AC-24, AC-25 and §6 (empty pages, document titles), on the real route table.

// Pages read AppContext, so routes render with real test services (spec 001 plan §6.11).
const renderAt = (path: string) => renderRoute(path);

afterEach(async () => {
  await closeTestDatabases();
});

const tabBar = () => screen.queryByRole('navigation', { name: 'Principal' });

describe('app router', () => {
  beforeEach(() => {
    // Same static title as index.html, so page titles must replace it.
    document.head.innerHTML = '<title>Gym</title>';
  });

  it('shows Hoy with the TabBar at /', async () => {
    await renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(tabBar()).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page');
  });

  it('AC-22: tapping Progreso navigates to /progreso and marks only that tab as current', async () => {
    const router = await renderAt('/');
    // Wait for Hoy to finish loading: a click while its content is still suspended on use(ready)
    // leaves the navigation pending inside the click's act.
    await screen.findByRole('list', { name: 'Semana' });
    await userEvent.click(screen.getByRole('link', { name: 'Progreso' }));

    expect(router.state.location.pathname).toBe('/progreso');
    expect(screen.getByRole('heading', { level: 1, name: 'Progreso' })).toBeInTheDocument();
    expect(screen.getByText('Aún no hay entrenamientos registrados.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Progreso' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Hoy' })).not.toHaveAttribute('aria-current');
  });

  it('AC-24: /sesion/:workoutId/:exerciseIndex shows the empty session page without TabBar', async () => {
    await renderAt('/sesion/w1/0');
    expect(screen.getByRole('heading', { level: 1, name: 'Sesión' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Hoy' })).toHaveAttribute('href', '/');
    expect(tabBar()).not.toBeInTheDocument();
  });

  it('AC-24: /sesion/:workoutId/cierre shows the close page, not an exercise index', async () => {
    await renderAt('/sesion/w1/cierre');
    expect(screen.getByRole('heading', { level: 1, name: 'Cierre de sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sesión' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Hoy' })).toHaveAttribute('href', '/');
    expect(tabBar()).not.toBeInTheDocument();
  });

  it('AC-25: an unknown route redirects to /', async () => {
    const router = await renderAt('/no-existe');
    expect(await screen.findByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it.each([
    ['/', 'Hoy · Gym'],
    ['/progreso', 'Progreso · Gym'],
    ['/sesion/w1/0', 'Sesión · Gym'],
    ['/sesion/w1', 'Sesión · Gym'], // "Continuar sesión" (spec 002 plan §6.7)
    ['/sesion/w1/cierre', 'Cierre de sesión · Gym'],
  ])('%s sets the document title to "%s"', async (path, title) => {
    await renderAt(path);
    expect(document.title).toBe(title);
  });
});
