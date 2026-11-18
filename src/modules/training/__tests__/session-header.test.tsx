import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { SessionHeader, type SetLog, type WorkoutItem, type WorkoutView } from '..';
import type { Exercise } from '../application/ports';
import { dominadas, jalon, prensa } from './fixtures/plan';

// SessionHeader (docs/modules/training.md §4, contract v1.18; spec 004 AC-1, AC-4 to AC-11, T5).
// A plain view is enough: the header only reads it.

const id = (s: string) => s as ID;
const femoral: Exercise = { ...prensa, id: id('femoral'), name: 'femoral' };
const plancha: Exercise = {
  ...prensa,
  id: id('plancha'),
  name: 'plancha',
  equipment: 'bodyweight',
  metric: 'time',
};

const item = (
  exerciseId: ID,
  options: ID[],
  order: number,
  plannedSets: number,
  repRange: [number, number] = [6, 10],
): WorkoutItem => ({
  exerciseId,
  options,
  order,
  plannedSets,
  maxSets: plannedSets + 1,
  repRange,
  targetRir: [3, 4],
});

let next = 0;
const set = (exerciseId: ID, setNumber: number, done: boolean, isExtra = false): SetLog => ({
  id: id(`set-${String((next += 1))}`),
  workoutId: id('w'),
  exerciseId,
  setNumber,
  weightKg: null,
  reps: null,
  rir: null,
  done,
  isExtra,
});

const items = [
  item(prensa.id, [prensa.id], 1, 2),
  item(jalon.id, [dominadas.id, jalon.id], 2, 2),
  item(femoral.id, [femoral.id], 3, 2),
  item(plancha.id, [plancha.id], 4, 2, [30, 45]),
];

// Prensa done with an extra (3 of 3); Jalón, chosen instead of Dominadas, in progress (1 of 2);
// Femoral pending with 1 of 2 done; Plancha pending with nothing done.
function view(sets?: SetLog[]): WorkoutView {
  return {
    workout: {
      id: id('w'),
      templateId: id('tpl-a'),
      name: 'Full body A',
      programWeek: 1,
      date: '2026-11-16' as LocalDate,
      plannedFor: '2026-11-16' as LocalDate,
      startedAt: '2026-11-16T18:00:00-06:00' as Instant,
      status: 'in_progress',
      items,
    },
    sets: sets ?? [
      set(prensa.id, 1, true),
      set(prensa.id, 2, true),
      set(prensa.id, 3, true, true),
      set(jalon.id, 1, true),
      set(jalon.id, 2, false),
      set(femoral.id, 1, true),
      set(femoral.id, 2, false),
      set(plancha.id, 1, false),
      set(plancha.id, 2, false),
    ],
    exercises: {
      [prensa.id]: prensa,
      [dominadas.id]: dominadas,
      [jalon.id]: jalon,
      [femoral.id]: femoral,
      [plancha.id]: plancha,
    },
  };
}

const allDone = () =>
  view([
    set(prensa.id, 1, true),
    set(prensa.id, 2, true),
    set(jalon.id, 1, true),
    set(femoral.id, 1, true),
    set(plancha.id, 1, true),
  ]);

function setup({
  index = 2,
  elapsed = <span>18:42</span>,
  v = view(),
}: { index?: number; elapsed?: React.ReactNode; v?: WorkoutView } = {}) {
  const onNavigate = vi.fn();
  const onExit = vi.fn();
  render(
    <SessionHeader
      view={v}
      index={index}
      elapsed={elapsed}
      onNavigate={onNavigate}
      onExit={onExit}
    />,
  );
  return { onNavigate, onExit, user: userEvent.setup() };
}

const toggle = (n = 2) => screen.getByRole('button', { name: `Ejercicio ${String(n)} de 4` });
const menu = () => screen.getByRole('dialog', { name: 'Full body A' });
const rows = () => within(menu()).getAllByRole('button');

describe('SessionHeader: la fila', () => {
  it('AC-1: flecha, "Ejercicio 2 de 4" y el tiempo; sin el nombre de la sesión ni encabezados', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Salir de la sesión' })).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByText('18:42')).toBeInTheDocument();
    expect(screen.queryByText('Full body A')).not.toBeInTheDocument();
    // The page's h1 is the exercise (spec 002 §6).
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('AC-35: el nombre de "Ejercicio N de M" es su texto visible, sin aria-label (WCAG 2.5.3)', () => {
    setup();
    expect(toggle()).not.toHaveAttribute('aria-label');
    expect(toggle()).toHaveTextContent('Ejercicio 2 de 4');
  });

  it('AC-3: con elapsed = null no hay tiempo', () => {
    setup({ elapsed: null });
    expect(screen.queryByText('18:42')).not.toBeInTheDocument();
  });

  it('la flecha llama a onExit', async () => {
    const { user, onExit, onNavigate } = setup();
    await user.click(screen.getByRole('button', { name: 'Salir de la sesión' }));
    expect(onExit).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('AC-11: no hay "Ver ejercicios" ni "Descartar sesión", tampoco en el menú', async () => {
    const { user } = setup();
    expect(screen.queryByRole('button', { name: 'Ver ejercicios' })).not.toBeInTheDocument();
    await user.click(toggle());
    expect(screen.queryByRole('button', { name: 'Descartar sesión' })).not.toBeInTheDocument();
  });
});

describe('SessionHeader: el menú', () => {
  it('AC-4: se abre como diálogo con el nombre de la sesión y el resumen como descripción', async () => {
    const { user } = setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu()).getByRole('heading', { level: 2, name: 'Full body A' })).toBeVisible();
    expect(menu()).toHaveAccessibleDescription('1 de 4 hechos · 1 en curso');
  });

  it('AC-5: una fila por ejercicio, en orden, con su estado en el nombre accesible', async () => {
    const { user } = setup();
    await user.click(toggle());

    expect(rows().map((row) => row.getAttribute('data-state'))).toEqual([
      'done',
      'current',
      'pending',
      'pending',
    ]);
    expect(within(menu()).getByRole('button', { name: 'prensa, hecho, 3 de 3 series' })).toBe(
      rows()[0],
    );
    expect(within(menu()).getByRole('button', { name: 'jalon, En curso · serie 2' })).toBe(
      rows()[1],
    );
  });

  it('AC-5: un pendiente con series hechas muestra su avance, sin ✓', async () => {
    const { user } = setup();
    await user.click(toggle());

    const row = within(menu()).getByRole('button', { name: 'femoral, pendiente, 1 de 2 series' });
    expect(within(row).queryByText('✓')).not.toBeInTheDocument();
  });

  it('AC-5: un pendiente sin series hechas muestra el objetivo, en segundos si es por tiempo', async () => {
    const { user } = setup();
    await user.click(toggle());

    expect(
      within(menu()).getByRole('button', { name: 'plancha, pendiente, 2 × 30-45 s' }),
    ).toBeInTheDocument();
  });

  it('AC-5: "1 de 1 serie" en singular', async () => {
    const { user } = setup({ v: allDone() });
    await user.click(toggle());
    expect(
      within(menu()).getByRole('button', { name: 'femoral, hecho, 1 de 1 serie' }),
    ).toBeInTheDocument();
  });

  it('AC-6: aria-current en el ejercicio que se ve, que no es el "en curso"', async () => {
    const { user } = setup({ index: 3 });
    await user.click(toggle(3));

    expect(rows().map((row) => row.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'step',
      null,
    ]);
    expect(rows()[1]).toHaveAttribute('data-state', 'current');
  });

  it('al abrir, el foco va a la fila del ejercicio que se ve', async () => {
    const { user } = setup({ index: 3 });
    await user.click(toggle(3));
    expect(rows()[2]).toHaveFocus();
  });

  it('AC-7: elegir una fila cierra el menú y llama a onNavigate con su número', async () => {
    const { user, onNavigate } = setup();
    await user.click(toggle());

    await user.click(within(menu()).getByRole('button', { name: /^femoral/ }));

    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(3);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('AC-8: Escape cierra sin navegar y el foco vuelve al botón', async () => {
    const { user, onNavigate } = setup();
    await user.click(toggle());

    fireEvent(menu(), new Event('cancel', { cancelable: true }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(toggle()).toHaveFocus();
  });

  it('AC-8: tocar el fondo cierra sin navegar', async () => {
    const { user, onNavigate } = setup();
    await user.click(toggle());

    await user.click(menu());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('AC-9: todo hecho: "4 de 4 hechos" sin "en curso" y todas con ✓', async () => {
    const { user } = setup({ v: allDone() });
    await user.click(toggle());

    expect(menu()).toHaveAccessibleDescription('4 de 4 hechos');
    expect(rows().map((row) => row.getAttribute('data-state'))).toEqual([
      'done',
      'done',
      'done',
      'done',
    ]);
  });

  it('AC-10: la fila lleva el nombre del ejercicio elegido, no el principal', async () => {
    const { user } = setup();
    await user.click(toggle());
    expect(within(menu()).queryByRole('button', { name: /^dominadas/ })).not.toBeInTheDocument();
    expect(within(menu()).getByRole('button', { name: /^jalon/ })).toBeInTheDocument();
  });
});
