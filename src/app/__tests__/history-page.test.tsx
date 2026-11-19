import 'fake-indexeddb/auto';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Workout } from '@/modules/training';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { closeTestDatabases, lastTestDatabase, renderRoute, tapToNavigate } from './test-app';
import { closeSession, setup } from './test-sessions';

// The history list (spec 006 AC-4 to AC-13, §6.1; plan §6.7) over the real seed. The program
// starts Monday 2026-11-16 and "Historial" opens on Wednesday 25 (week 2). Week 1: Full body A on
// Monday and Friday, Full body B on Wednesday; week 2: Full body B on Monday and Friday, Full body
// A on Wednesday. Weeks 1-4 are "Bloque 1 · Full body". Example sessions of the spec (§4):
//   L16: Full body A, all 10 sets, 18:00 → 18:52, pain 2.
//   M18: Full body A of Friday 20, done on Wednesday 18, 5 sets in 3 exercises, 18:00 → 18:30,
//        pain 5 with "Hormigueo o adormecimiento".
//   L23: Full body B, all sets, 18:00 → 18:45, pain 3.

const date = (s: string) => s as LocalDate;
const WEDNESDAY_25 = '2026-11-25T08:00:00-06:00';

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

async function examples() {
  const ctx = await setup(WEDNESDAY_25);
  const l16 = await closeSession(ctx, { on: '2026-11-16', allSets: true, level: 2 });
  const m18 = await closeSession(ctx, {
    on: '2026-11-18',
    plannedFor: '2026-11-20',
    sets: 5,
    end: '18:30',
    level: 5,
    redFlags: ['numbness'],
  });
  const l23 = await closeSession(ctx, { on: '2026-11-23', allSets: true, end: '18:45', level: 3 });
  return { ...ctx, l16, m18, l23 };
}

async function openHistory(services: Awaited<ReturnType<typeof setup>>['services']) {
  const router = await renderRoute('/historial', services);
  await screen.findByRole('heading', { level: 1, name: 'Historial' });
  return router;
}

const group = (name: string) => screen.getByRole('region', { name });
const rows = (region: HTMLElement) => within(region).getAllByRole('link');
const rowOf = (region: HTMLElement, title: string) => {
  const row = rows(region).find((r) => within(r).queryByText(title));
  if (!row) throw new Error(`no row ${title}`);
  return row;
};

describe('lista del historial', () => {
  it('spec 006 AC-4: sin sesiones guardadas, el texto del vacío', async () => {
    const { services } = await setup(WEDNESDAY_25);
    await openHistory(services);

    expect(
      await screen.findByText(
        'Aún no hay sesiones guardadas. Cuando termines una, aparecerá aquí.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Semana/ })).not.toBeInTheDocument();
  });

  it('spec 006 §6.4: mientras la consulta no responde no muestra el vacío', async () => {
    const { services } = await setup(WEDNESDAY_25);
    vi.spyOn(services.training, 'listWorkoutHistory').mockReturnValue(new Promise(() => undefined));
    await openHistory(services);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(screen.queryByText(/Aún no hay sesiones guardadas/)).not.toBeInTheDocument();
  });

  it('spec 006 AC-5: dos grupos, del más reciente al más antiguo, y sus filas en orden', async () => {
    const { services, l16, m18, l23 } = await examples();
    await openHistory(services);

    const groups = await screen.findAllByRole('region', { name: /^Semana/ });
    expect(groups.map((g) => within(g).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Semana 2',
      'Semana 1',
    ]);
    const hrefs = (name: string) => rows(group(name)).map((r) => r.getAttribute('href'));
    expect(hrefs('Semana 2')).toEqual([`/historial/${l23.id}`]);
    expect(hrefs('Semana 1')).toEqual([`/historial/${m18.id}`, `/historial/${l16.id}`]);
  });

  it('spec 006 AC-6: encabezado de cada grupo con el bloque y el rango de fechas', async () => {
    const { services } = await examples();
    await openHistory(services);

    expect(
      await within(await screen.findByRole('region', { name: 'Semana 2' })).findByText(
        'Bloque 1 · Full body · 23-29 nov',
      ),
    ).toBeInTheDocument();
    expect(within(group('Semana 1')).getByText('Bloque 1 · Full body · 16-22 nov')).toBeVisible();
  });

  it('spec 006 AC-7: la fila de una sesión completa', async () => {
    const { services } = await examples();
    await openHistory(services);
    const row = rowOf(
      await screen.findByRole('region', { name: 'Semana 1' }),
      'Lun 16 · Full body A',
    );

    expect(within(row).getByText('52 min · 10 series · 7 ejercicios')).toBeVisible();
    const chip = within(row).getByText('Espalda 2/10');
    expect(chip).not.toHaveAttribute('data-warn');
    expect(within(row).queryByText('Señal de alarma')).not.toBeInTheDocument();
  });

  it('spec 006 AC-8: la fila de una sesión parcial de otro día del plan, con señal de alarma', async () => {
    const { services } = await examples();
    await openHistory(services);
    const row = rowOf(
      await screen.findByRole('region', { name: 'Semana 1' }),
      'Mié 18 · Full body A del viernes',
    );

    expect(within(row).getByText('30 min · 5 series · 3 de 7 ejercicios')).toBeVisible();
    expect(within(row).getByText('Espalda 5/10')).toHaveAttribute('data-warn');
    expect(within(row).getByText('Señal de alarma')).toHaveAttribute('data-warn');
  });

  it('spec 006 AC-9: la fila es un enlace al detalle con todo su texto visible en el nombre', async () => {
    const { services, l16 } = await examples();
    const router = await openHistory(services);
    const row = rowOf(
      await screen.findByRole('region', { name: 'Semana 1' }),
      'Lun 16 · Full body A',
    );

    expect(row).toHaveAccessibleName(
      'Lun 16 · Full body A 52 min · 10 series · 7 ejercicios Espalda 2/10',
    );
    await tapToNavigate(userEvent.setup(), row);

    expect(router.state.location.pathname).toBe(`/historial/${l16.id}`);
    expect(router.state.location.state).toEqual({ from: '/historial' });
  });

  it('spec 006 AC-10: las sesiones en curso y descartadas no salen', async () => {
    const ctx = await examples();
    const { training } = ctx.services;
    ctx.time.set('2026-11-27T18:00:00-06:00');
    const friday = await training.startWorkout(date('2026-11-27'));
    if (!friday.ok) throw new Error(friday.error.code);
    await training.discardWorkout(friday.value.id);
    ctx.time.set('2026-11-25T18:00:00-06:00');
    const wednesday = await training.startWorkout(date('2026-11-25'));
    if (!wednesday.ok) throw new Error(wednesday.error.code);
    await openHistory(ctx.services);

    const groups = await screen.findAllByRole('region', { name: /^Semana/ });
    expect(groups.flatMap(rows)).toHaveLength(3);
  });

  it('spec 006 AC-11: dos cerradas el mismo día (datos anteriores a RN-TRN-27) salen las dos', async () => {
    const { services, l16, m18 } = await examples();
    const later: Workout = {
      ...l16,
      id: 'l16-later' as ID,
      startedAt: '2026-11-16T19:00:00-06:00' as Instant,
      finishedAt: '2026-11-16T19:30:00-06:00' as Instant,
    };
    await lastTestDatabase().table('workouts').add(later);
    await openHistory(services);

    const week1 = rows(await screen.findByRole('region', { name: 'Semana 1' }));
    expect(week1.map((r) => r.getAttribute('href'))).toEqual([
      `/historial/${m18.id}`,
      '/historial/l16-later',
      `/historial/${l16.id}`,
    ]);
  });

  it('spec 006 AC-12: una sesión fuera del programa va en su propio grupo', async () => {
    const { services, l16 } = await examples();
    const outside: Workout = {
      ...l16,
      id: 'fuera' as ID,
      programWeek: null,
      date: date('2026-11-11'),
      plannedFor: date('2026-11-11'),
      startedAt: '2026-11-11T18:00:00-06:00' as Instant,
      finishedAt: '2026-11-11T18:40:00-06:00' as Instant,
    };
    await lastTestDatabase().table('workouts').add(outside);
    await openHistory(services);

    const region = await screen.findByRole('region', { name: 'Fuera del programa' });
    expect(within(region).getByText('9-15 nov')).toBeVisible();
    expect(rows(region).map((r) => r.getAttribute('href'))).toEqual(['/historial/fuera']);
  });

  it('spec 006 AC-13: una sesión cerrada con la lista abierta aparece sin recargar', async () => {
    const ctx = await setup(WEDNESDAY_25);
    await closeSession(ctx, { on: '2026-11-16', allSets: true, level: 2 });
    await openHistory(ctx.services);
    await screen.findByRole('region', { name: 'Semana 1' });
    expect(screen.queryByRole('region', { name: 'Semana 2' })).not.toBeInTheDocument();

    await act(() => closeSession(ctx, { on: '2026-11-23', allSets: true, level: 3 }));

    expect(await screen.findByRole('region', { name: 'Semana 2' })).toBeInTheDocument();
  });
});
