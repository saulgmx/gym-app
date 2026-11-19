import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixedClock, type ID, type LocalDate } from '@/shared/kernel';
import {
  createPlan,
  PlanExerciseList,
  planStores,
  WeekStrip,
  type PlanApi,
  type ProgramPosition,
  type TodayPlan,
} from '..';
import { valid } from './fixtures/seed';

// WeekStrip and PlanExerciseList (spec 001 AC-15, plan §6.10; spec 003 AC-3, AC-4, AC-10 to AC-12).
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

  it('spec 003 AC-3: una fila por ejercicio, en orden, con series × reps y nota, sin RIR', async () => {
    const [prensa, plancha] = await renderMonday();

    expect(prensa).toHaveTextContent('Prensa de piernas');
    expect(prensa).toHaveTextContent('2 × 8-12');
    expect(prensa).not.toHaveTextContent('RIR');
    expect(prensa).toHaveTextContent('Pies bajos');

    // spec 003 AC-4, time metric: seconds; 2 sets × 0.7 rounds to 1 (RN-PLN-05).
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

    expect(plancha?.textContent).toBe('Plancha1 × 30-45 s');
  });
});

describe('WeekStrip', () => {
  // Week 1 of the real seed (spec 003 §4): Mon A, Tue cardio, Wed B, Thu rest, Fri A, Sat cardio,
  // Sun rest. Built by hand: the small fixture has no cardio on Saturday.
  const position: ProgramPosition = {
    status: 'active',
    startDate: MONDAY,
    totalWeeks: 15,
    week: 1,
    block: null,
    isDeloadWeek: false,
    volumeFactor: 0.7,
  };
  const workout = (name: string): TodayPlan => ({
    kind: 'workout',
    position,
    template: { id: name as ID, blockId: 'b1' as ID, name, items: [] },
    plannedItems: [],
  });
  const week1: TodayPlan[] = [
    workout('Full body A'),
    { kind: 'cardio', position, note: 'Cardio suave' },
    workout('Full body B'),
    { kind: 'rest', position },
    workout('Full body A'),
    { kind: 'cardio', position, note: 'Cardio suave' },
    { kind: 'rest', position },
  ];

  // done is empty unless a test says otherwise: spec 003 behaves as before (contract v1.16).
  function renderWeek1(today: LocalDate, done: ReadonlySet<LocalDate> = new Set()) {
    render(<WeekStrip days={week1} weekStart={MONDAY} today={today} done={done} />);
    const items = within(screen.getByRole('list', { name: 'Semana' })).getAllByRole('listitem');
    const marks = items.map((item) => item.querySelector('[data-mark]'));
    return { items, marks };
  }

  const label = (item: HTMLElement) => within(item).getByRole('img').getAttribute('aria-label');
  const nth = (items: HTMLElement[], i: number) => {
    const item = items[i];
    if (!item) throw new Error(`No day ${String(i)}`);
    return item;
  };

  it('AC-12: una lista de 7 días; cada uno se lee como "<día>, [hoy,] <sesión>, <estado>"', () => {
    const { items } = renderWeek1(WEDNESDAY);

    expect(items).toHaveLength(7);
    expect(items.map(label)).toEqual([
      'lunes, Full body A, no hecha',
      'martes, cardio',
      'miércoles, hoy, Full body B, pendiente',
      'jueves, descanso',
      'viernes, Full body A, pendiente',
      'sábado, cardio',
      'domingo, descanso',
    ]);
    expect(
      screen.getByRole('img', { name: 'miércoles, hoy, Full body B, pendiente' }),
    ).toBeInTheDocument();
  });

  it('AC-12: las letras y las marcas no se leen aparte', () => {
    const { items } = renderWeek1(WEDNESDAY);

    for (const item of items) {
      expect(spoken(item)).toBe('');
      expect(within(item).getAllByRole('img')).toHaveLength(1);
    }
    expect(items.some((item) => item.hasAttribute('aria-current'))).toBe(false);
  });

  it('AC-10: letras L a D, anillo vacío en pesas, "C" en cardio, "–" en descanso y ● solo hoy', () => {
    const { items, marks } = renderWeek1(WEDNESDAY);

    expect(items.map(visible)).toEqual(['L ', 'M C', 'X ●', 'J –', 'V ', 'S C', 'D –']);
    expect(marks.map((m) => m?.getAttribute('data-mark'))).toEqual([
      'workout',
      'cardio',
      'workout',
      'rest',
      'workout',
      'cardio',
      'rest',
    ]);
    expect(marks.map((m) => m?.hasAttribute('data-today'))).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('AC-11: el jueves (descanso) el anillo de hoy rodea "–", sin ●', () => {
    const { items, marks } = renderWeek1(date('2026-11-19'));

    expect(visible(nth(items, 3))).toBe('J –');
    expect(marks[3]).toHaveAttribute('data-today');
    expect(label(nth(items, 3))).toBe('jueves, hoy, descanso');
    expect(items.map(visible)).not.toContain('X ●');
    expect(label(nth(items, 2))).toBe('miércoles, Full body B, no hecha');
  });

  it('AC-11: el sábado (cardio) el anillo de hoy rodea "C", sin ●', () => {
    const { items, marks } = renderWeek1(date('2026-11-21'));

    expect(visible(nth(items, 5))).toBe('S C');
    expect(marks[5]).toHaveAttribute('data-today');
    expect(label(nth(items, 5))).toBe('sábado, hoy, cardio');
    expect(label(nth(items, 4))).toBe('viernes, Full body A, no hecha');
    expect(items.map(visible).join(' ')).not.toContain('●');
  });

  it('normaliza weekStart al lunes, como getWeekPlan (RN-PLN-10)', () => {
    render(
      <WeekStrip days={week1} weekStart={date('2026-11-19')} today={WEDNESDAY} done={new Set()} />,
    );

    expect(screen.getAllByRole('img')[2]).toHaveAccessibleName(
      'miércoles, hoy, Full body B, pendiente',
    );
  });

  it('fuera del programa: "—" a la vista y "fuera del programa" para el lector', async () => {
    const days = await plan.getWeekPlan(date('2026-11-09'));
    render(
      <WeekStrip
        days={days}
        weekStart={date('2026-11-09')}
        today={date('2026-11-12')}
        done={new Set()}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(visible(nth(items, 0))).toBe('L —');
    expect(label(nth(items, 0))).toBe('lunes, fuera del programa');
    expect(label(nth(items, 3))).toBe('jueves, hoy, fuera del programa');
  });

  // Spec 005 (contract v1.16, decision 19): days of the plan already done.
  const FRIDAY = date('2026-11-20');

  it('spec 005 AC-32: el lunes hecho se dibuja con ✓ y se lee "hecha"', () => {
    const { items, marks } = renderWeek1(WEDNESDAY, new Set([MONDAY]));

    expect(label(nth(items, 0))).toBe('lunes, Full body A, hecha');
    expect(marks[0]?.getAttribute('data-mark')).toBe('done');
    expect(visible(nth(items, 0))).toBe('L ✓');
    // The rest stays as in spec 003.
    expect(label(nth(items, 4))).toBe('viernes, Full body A, pendiente');
  });

  it('spec 005 AC-33: un día de pesas futuro en done también está hecho', () => {
    const { items, marks } = renderWeek1(WEDNESDAY, new Set([FRIDAY]));

    expect(label(nth(items, 4))).toBe('viernes, Full body A, hecha');
    expect(marks[4]?.getAttribute('data-mark')).toBe('done');
    expect(label(nth(items, 2))).toBe('miércoles, hoy, Full body B, pendiente');
  });

  it('spec 005 AC-34: hoy hecho lleva ✓ y el anillo de hoy', () => {
    const { items, marks } = renderWeek1(WEDNESDAY, new Set([WEDNESDAY]));

    expect(label(nth(items, 2))).toBe('miércoles, hoy, Full body B, hecha');
    expect(marks[2]?.getAttribute('data-mark')).toBe('done');
    expect(marks[2]?.hasAttribute('data-today')).toBe(true);
    expect(visible(nth(items, 2))).toBe('X ✓');
  });

  it('spec 005 AC-36: un día de pesas pasado fuera de done sigue "no hecha"', () => {
    const { items, marks } = renderWeek1(WEDNESDAY, new Set([FRIDAY]));

    expect(label(nth(items, 0))).toBe('lunes, Full body A, no hecha');
    expect(marks[0]?.getAttribute('data-mark')).toBe('workout');
  });

  it('spec 005 §7: cardio y descanso en done siguen siendo cardio y descanso', () => {
    const { items, marks } = renderWeek1(
      WEDNESDAY,
      new Set([date('2026-11-17'), date('2026-11-19')]),
    );

    expect(label(nth(items, 1))).toBe('martes, cardio');
    expect(label(nth(items, 3))).toBe('jueves, descanso');
    expect(marks.map((m) => m?.getAttribute('data-mark'))).not.toContain('done');
  });

  it('contrato v1.16: una fecha de otra semana en done no marca nada', () => {
    // Monday of the next week; the strip is week 1.
    const { marks } = renderWeek1(WEDNESDAY, new Set([date('2026-11-23')]));

    expect(marks.map((m) => m?.getAttribute('data-mark'))).not.toContain('done');
  });

  it('contrato v1.16: el ✓ no se lee aparte', () => {
    const { items } = renderWeek1(WEDNESDAY, new Set([MONDAY, WEDNESDAY]));

    for (const item of items) expect(spoken(item)).toBe('');
  });
});
