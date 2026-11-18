import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { SessionHeader, type SetLog, type WorkoutItem, type WorkoutView } from '..';
import { dominadas, jalon, prensa } from './fixtures/plan';

// SessionHeader (docs/modules/training.md §4, contract v1.12; spec 002 AC-25, AC-26). A plain
// view is enough: the header only reads it.

const id = (s: string) => s as ID;

const item = (exerciseId: ID, options: ID[], order: number, plannedSets: number): WorkoutItem => ({
  exerciseId,
  options,
  order,
  plannedSets,
  maxSets: plannedSets + 1,
  repRange: [8, 12],
  targetRir: [3, 4],
});

let next = 0;
const set = (exerciseId: ID, setNumber: number, done: boolean): SetLog => ({
  id: id(`set-${String((next += 1))}`),
  workoutId: id('w'),
  exerciseId,
  setNumber,
  weightKg: null,
  reps: null,
  rir: null,
  done,
  isExtra: false,
});

// Prensa with 1 of 2 sets done; Jalón, chosen instead of Dominadas, with its only set done.
function view(): WorkoutView {
  return {
    workout: {
      id: id('w'),
      templateId: id('tpl-a'),
      name: 'Full body A',
      programWeek: 1,
      date: '2026-11-21' as LocalDate,
      plannedFor: '2026-11-21' as LocalDate,
      startedAt: '2026-11-21T09:30:00-06:00' as Instant,
      status: 'in_progress',
      items: [item(prensa.id, [prensa.id], 1, 2), item(jalon.id, [dominadas.id, jalon.id], 2, 1)],
    },
    sets: [set(prensa.id, 1, true), set(prensa.id, 2, false), set(jalon.id, 1, true)],
    exercises: { [prensa.id]: prensa, [dominadas.id]: dominadas, [jalon.id]: jalon },
  };
}

function setup(index = 2) {
  const onNavigate = vi.fn();
  const onDiscard = vi.fn();
  render(
    <SessionHeader view={view()} index={index} onNavigate={onNavigate} onDiscard={onDiscard} />,
  );
  return { onNavigate, onDiscard, user: userEvent.setup() };
}

const toggle = () => screen.getByRole('button', { name: 'Ver ejercicios' });

describe('SessionHeader', () => {
  it('AC-25: el nombre de la sesión y "Ejercicio 1 de 2"', () => {
    setup(1);

    expect(screen.getByText('Full body A')).toBeInTheDocument();
    // The page's h1 is the exercise (spec 002 §6).
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Ejercicio 1 de 2')).toBeInTheDocument();
  });

  it('AC-26: "Ver ejercicios" empieza cerrado y despliega la lista', async () => {
    const { user } = setup();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    await user.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('AC-26: cada ejercicio con su avance, en orden; el elegido y no la principal', async () => {
    const { user } = setup();
    await user.click(toggle());

    const rows = within(screen.getByRole('list')).getAllByRole('button');

    expect(rows.map((r) => r.textContent)).toEqual([
      `${prensa.name} · 1 de 2 series`,
      `${jalon.name} · 1 de 1 serie · hecho`,
    ]);
  });

  it('AC-26: el ejercicio actual lleva aria-current="step"', async () => {
    const { user } = setup(1);
    await user.click(toggle());

    const [first, second] = within(screen.getByRole('list')).getAllByRole('button');

    expect(first).toHaveAttribute('aria-current', 'step');
    expect(second).not.toHaveAttribute('aria-current');
  });

  it('AC-26: elegir un ejercicio navega a su número y cierra la lista', async () => {
    const { user, onNavigate } = setup();
    await user.click(toggle());

    await user.click(screen.getByRole('button', { name: new RegExp(`^${prensa.name}`) }));

    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(1);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('"Descartar sesión" va al final de la lista y llama a onDiscard', async () => {
    const { user, onDiscard, onNavigate } = setup();
    expect(screen.queryByRole('button', { name: 'Descartar sesión' })).not.toBeInTheDocument();
    await user.click(toggle());

    const discard = screen.getByRole('button', { name: 'Descartar sesión' });
    const buttons = screen.getAllByRole('button');

    expect(buttons.at(-1)).toBe(discard);
    await user.click(discard);
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
