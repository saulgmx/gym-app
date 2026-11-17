import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixedClock, type LocalDate } from '@/shared/kernel';
import { createPlan, PlanExerciseList, planStores, WeekStrip, type PlanApi } from '..';
import { valid } from './fixtures/seed';

// WeekStrip and PlanExerciseList with real plan data (spec 001 AC-15, AC-17, plan §6.10).
// Fixture: weeks 1-2 from Monday 2026-11-16; week 1 Monday Full body A (factor 0.7, RIR 3-4).

const date = (s: string) => s as LocalDate;
const MONDAY = date('2026-11-16');
const WEDNESDAY = date('2026-11-18');

let db: Dexie;
let plan: PlanApi;

beforeEach(async () => {
  db = new Dexie(crypto.randomUUID());
  db.version(1).stores(planStores);
  plan = createPlan({ db, clock: fixedClock('2026-11-18T08:00:00-06:00') });
  await plan.ensureSeeded(valid());
});

afterEach(async () => {
  db.close();
  await Dexie.delete(db.name);
});

// What a screen reader reads: the text outside aria-hidden subtrees.
function spoken(element: HTMLElement): string {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => {
    node.remove();
  });
  return copy.textContent.trim();
}

// What is drawn: the aria-hidden part.
function visible(element: HTMLElement): string {
  return [...element.querySelectorAll('[aria-hidden="true"]')]
    .map((node) => node.textContent)
    .join(' ');
}

describe('PlanExerciseList', () => {
  async function renderMonday() {
    const today = await plan.getTodayPlan(MONDAY);
    if (today.kind !== 'workout') throw new Error('Monday is a workout day');
    render(<PlanExerciseList items={today.plannedItems} />);
    return screen.getAllByRole('listitem');
  }

  it('AC-15: una fila por ejercicio, en orden, con series × reps, RIR y nota', async () => {
    const [prensa, plancha] = await renderMonday();

    expect(prensa).toHaveTextContent('Prensa de piernas');
    expect(prensa).toHaveTextContent('2 × 8-12');
    expect(prensa).toHaveTextContent('RIR 3-4');
    expect(prensa).toHaveTextContent('Pies bajos');

    // Time metric: seconds; 2 sets × 0.7 rounds to 1 (RN-PLN-05).
    expect(plancha).toHaveTextContent('Plancha');
    expect(plancha).toHaveTextContent('1 × 30-45 s');
  });

  it('es una lista ordenada y no muestra alternativas en la fase 1', async () => {
    const items = await renderMonday();

    expect(items).toHaveLength(2);
    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(screen.queryByText(/Pallof/)).not.toBeInTheDocument();
  });

  it('una fila sin nota no muestra texto de nota', async () => {
    const [, plancha] = await renderMonday();

    expect(plancha?.textContent).toBe('Plancha1 × 30-45 sRIR 3-4');
  });
});

describe('WeekStrip', () => {
  async function renderWeek(weekStart: LocalDate, today: LocalDate) {
    const days = await plan.getWeekPlan(weekStart);
    render(<WeekStrip days={days} weekStart={weekStart} today={today} />);
    return within(screen.getByRole('list', { name: 'Semana' })).getAllByRole('listitem');
  }

  it('AC-17: 7 días de lunes a domingo con nombre accesible "día, sesión"', async () => {
    const days = await renderWeek(MONDAY, WEDNESDAY);

    expect(days.map(spoken)).toEqual([
      'lunes, Full body A',
      'martes, cardio',
      'miércoles, Full body B',
      'jueves, descanso',
      'viernes, descanso',
      'sábado, descanso',
      'domingo, descanso',
    ]);
  });

  it('AC-17: inicial e indicador de texto, que no depende solo del color', async () => {
    const days = await renderWeek(MONDAY, WEDNESDAY);

    expect(days.map(visible)).toEqual([
      'L Pesas',
      'M Cardio',
      'X Pesas',
      'J Libre',
      'V Libre',
      'S Libre',
      'D Libre',
    ]);
  });

  it('AC-17: solo hoy lleva aria-current="date"', async () => {
    const days = await renderWeek(MONDAY, WEDNESDAY);

    expect(days.map((d) => d.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'date',
      null,
      null,
      null,
      null,
    ]);
  });

  it('normaliza weekStart al lunes, como getWeekPlan (RN-PLN-10)', async () => {
    const days = await plan.getWeekPlan(date('2026-11-19'));
    render(<WeekStrip days={days} weekStart={date('2026-11-19')} today={WEDNESDAY} />);

    const items = screen.getAllByRole('listitem');
    expect(items.map((d) => d.getAttribute('aria-current'))[2]).toBe('date');
  });

  it('fuera del programa: "—" a la vista y "fuera del programa" para el lector', async () => {
    const days = await renderWeek(date('2026-11-09'), date('2026-11-12'));

    const [monday] = days;
    if (!monday) throw new Error('Monday is rendered');
    expect(visible(monday)).toBe('L —');
    expect(spoken(monday)).toBe('lunes, fuera del programa');
    expect(days[3]?.getAttribute('aria-current')).toBe('date');
  });
});
