import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixedClock, sequentialIds, type ID, type LocalDate } from '@/shared/kernel';
import {
  createTraining,
  SetTable,
  trainingStores,
  useWorkoutView,
  type SetLog,
  type TrainingApi,
  type TrainingError,
  type Workout,
} from '..';
import type { Exercise, PlanReader, TodayPlan } from '../application/ports';
import type { SetErrorContext } from '../domain/types';

// SetTable over the real training module (docs/modules/training.md §4, contract v1.11; spec 002
// AC-12 to AC-20, AC-29 to AC-33).

const id = (s: string) => s as ID;
const exercise = (key: string, overrides: Partial<Exercise>): Exercise => ({
  id: id(key),
  name: key,
  muscleGroup: 'quads',
  equipment: 'machine',
  metric: 'weight',
  lumbarRisk: 'low',
  isPrimary: false,
  restSeconds: [60, 90],
  ...overrides,
});
const prensa = exercise('prensa', {});
const dominadas = exercise('dominadas', { muscleGroup: 'back', equipment: 'bodyweight' });
const plancha = exercise('plancha', {
  muscleGroup: 'core',
  equipment: 'bodyweight',
  metric: 'time',
});
const deadBug = exercise('dead-bug', {
  muscleGroup: 'core',
  equipment: 'bodyweight',
  metric: 'reps',
});
const catalog = [prensa, dominadas, plancha, deadBug];

const planned = (e: Exercise, order: number, plannedSets: number) => ({
  exercise: e,
  alternatives: [],
  order,
  plannedSets,
  repRange: [8, 12] as [number, number],
  targetRir: [3, 4] as [number, number],
});

// Every day: Prensa 2 of 3, Dominadas 2 of 3, Plancha 1 of 2 and Dead bug 1 of 1.
const day: TodayPlan = {
  kind: 'workout',
  position: {
    status: 'active',
    startDate: '2026-11-16' as LocalDate,
    totalWeeks: 15,
    week: 1,
    block: null,
    isDeloadWeek: false,
    volumeFactor: 0.7,
  },
  template: {
    id: id('tpl'),
    blockId: id('block'),
    name: 'Full body A',
    items: [
      { exerciseId: prensa.id, order: 1, sets: [3, 3], reps: [8, 12] },
      { exerciseId: dominadas.id, order: 2, sets: [3, 3], reps: [6, 10] },
      { exerciseId: plancha.id, order: 3, sets: [2, 2], reps: [30, 45] },
      { exerciseId: deadBug.id, order: 4, sets: [1, 1], reps: [8, 10] },
    ],
  },
  plannedItems: [
    planned(prensa, 1, 2),
    planned(dominadas, 2, 2),
    planned(plancha, 3, 1),
    planned(deadBug, 4, 1),
  ],
};
const plan: PlanReader = {
  getTodayPlan: () => Promise.resolve(day),
  getExercises: (ids) => Promise.resolve(catalog.filter((e) => ids.includes(e.id))),
};

let db: Dexie;
let training: TrainingApi;

beforeEach(() => {
  db = new Dexie(crypto.randomUUID());
  db.version(1).stores(trainingStores);
  training = createTraining({
    db,
    clock: fixedClock('2026-11-21T09:30:00-06:00'),
    ids: sequentialIds(),
    plan,
    suggestions: { getPrefill: () => Promise.resolve(null) },
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  db.close();
  await Dexie.delete(db.name);
});

// The texts belong to app; this fake shows what the table asked for.
const describeError = (error: TrainingError, { metric, assisted }: SetErrorContext) =>
  error.code === 'training/invalid-set-values'
    ? `${error.details.field}/${error.details.reason}/${metric}/${String(assisted)}`
    : error.code;

function Table({ workoutId, exerciseId }: { workoutId: ID; exerciseId: ID }) {
  const view = useWorkoutView(training, workoutId);
  if (!view) return null;
  return (
    <SetTable
      training={training}
      view={view}
      exerciseId={exerciseId}
      describeError={describeError}
    />
  );
}

async function start(date = '2026-11-21'): Promise<Workout> {
  const result = await training.startWorkout(date as LocalDate);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

async function setsOf(exerciseId: ID): Promise<SetLog[]> {
  const sets = await db.table<SetLog>('sets').where('exerciseId').equals(exerciseId).toArray();
  return sets.sort((a, b) => a.setNumber - b.setNumber);
}

async function show(exerciseId: ID, workout?: Workout) {
  const w = workout ?? (await start());
  render(<Table workoutId={w.id} exerciseId={exerciseId} />);
  await screen.findByRole('table');
  return w;
}

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Element missing');
  return value;
}

const field = (name: string) => screen.getByRole('textbox', { name });
const check = (n: number) => screen.getByRole('checkbox', { name: `Serie ${String(n)} hecha` });

describe('columnas y campos', () => {
  it('con peso: Serie, Anterior, kg, Reps, RIR y el check; nombres por fila', async () => {
    await show(prensa.id);

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Serie',
      'Anterior',
      'kg',
      'Reps',
      'RIR',
      'Hecha',
    ]);
    expect(field('Serie 1, kilos')).toHaveAttribute('inputmode', 'decimal');
    expect(field('Serie 1, repeticiones')).toHaveAttribute('inputmode', 'numeric');
    expect(field('Serie 2, RIR')).toHaveAttribute('inputmode', 'numeric');
    expect(check(2)).not.toBeChecked();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2 * 2); // a problem row under each set
  });

  it('AC-26 (spec 004): time: columna "Seg" y sin kg; reps: sin kg', async () => {
    const workout = await show(plancha.id);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Serie',
      'Anterior',
      'Seg',
      'RIR',
      'Hecha',
    ]);
    expect(field('Serie 1, segundos')).toBeInTheDocument();

    render(<Table workoutId={workout.id} exerciseId={deadBug.id} />);
    await waitFor(() => {
      expect(screen.getAllByRole('table')).toHaveLength(2);
    });
    const deadBugTable = must(screen.getAllByRole('table')[1]);
    expect(within(deadBugTable).queryByRole('columnheader', { name: 'kg' })).toBeNull();
  });
});

describe('pistas de los campos (spec 004 AC-27)', () => {
  it('reps y RIR muestran el rango del ítem como placeholder; kg no tiene pista', async () => {
    await show(prensa.id);

    expect(field('Serie 1, repeticiones')).toHaveAttribute('placeholder', '8-12');
    expect(field('Serie 1, RIR')).toHaveAttribute('placeholder', '3-4');
    expect(field('Serie 2, repeticiones')).toHaveAttribute('placeholder', '8-12');
    expect(field('Serie 1, kilos')).not.toHaveAttribute('placeholder');
  });

  it('en tiempo, la pista de los segundos es el rango del ítem', async () => {
    await show(plancha.id);
    expect(field('Serie 1, segundos')).toHaveAttribute('placeholder', '8-12');
  });

  it('la pista no es un valor: el campo está vacío y no se guarda nada', async () => {
    await show(prensa.id);
    const reps = field('Serie 1, repeticiones');

    await userEvent.click(reps);
    await userEvent.tab();

    expect(reps).toHaveValue('');
    expect((await setsOf(prensa.id))[0]?.reps).toBeNull();
  });
});

describe('serie actual (spec 004 AC-28 a AC-30)', () => {
  const currentRows = () =>
    screen.getAllByRole('row').filter((row) => row.hasAttribute('data-current'));
  const currentNumber = () =>
    currentRows().map((row) => within(row).getByRole('rowheader').textContent);

  async function fillAndCheck(n: number, kg: string, reps: string, rir: string) {
    const s = String(n);
    await userEvent.type(field(`Serie ${s}, kilos`), `${kg}{Enter}`);
    await userEvent.type(field(`Serie ${s}, repeticiones`), `${reps}{Enter}`);
    await userEvent.type(field(`Serie ${s}, RIR`), `${rir}{Enter}`);
    await waitFor(async () => {
      expect((await setsOf(prensa.id))[n - 1]?.rir).toBe(Number(rir));
    });
    await userEvent.click(check(n));
    await waitFor(() => {
      expect(check(n)).toBeChecked();
    });
  }

  it('AC-28: la primera serie sin hacer es la actual, y solo ella', async () => {
    await show(prensa.id);
    expect(currentNumber()).toEqual(['1']);

    await fillAndCheck(1, '60', '10', '3');

    await waitFor(() => {
      expect(currentNumber()).toEqual(['2']);
    });
  });

  it('AC-29: sin series pendientes no hay serie actual; una extra pasa a ser la actual', async () => {
    await show(prensa.id);
    await fillAndCheck(1, '60', '10', '3');
    await fillAndCheck(2, '60', '9', '3');
    await waitFor(() => {
      expect(currentRows()).toHaveLength(0);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Añadir serie' }));

    await waitFor(() => {
      expect(currentNumber()).toEqual(['3extra']);
    });
  });

  it('AC-30: es la del ejercicio que se ve, aunque otro tenga series pendientes antes', async () => {
    // Prensa (order 1) has nothing done; Dominadas still shows its own first set.
    await show(dominadas.id);
    expect(currentNumber()).toEqual(['1']);
  });
});

describe('guardar un campo (RN-TRN-03)', () => {
  it('al salir del campo guarda con coma decimal y muestra "62,5" (AC-12)', async () => {
    await show(prensa.id);

    await userEvent.type(field('Serie 1, kilos'), '62,5');
    await userEvent.tab();

    await waitFor(async () => {
      expect((await setsOf(prensa.id))[0]?.weightKg).toBe(62.5);
    });
    expect(field('Serie 1, kilos')).toHaveValue('62,5');
  });

  it('mientras la vista guardada llega, el campo conserva lo escrito (sin parpadeo)', async () => {
    // The view reads plan after the write; a slow plan makes that gap visible every time.
    const slow: PlanReader = {
      ...plan,
      getExercises: (ids) =>
        new Promise((resolve) => setTimeout(() => void plan.getExercises(ids).then(resolve), 50)),
    };
    training = createTraining({
      db,
      clock: fixedClock('2026-11-21T09:30:00-06:00'),
      ids: sequentialIds('slow'),
      plan: slow,
      suggestions: { getPrefill: () => Promise.resolve(null) },
    });
    await show(prensa.id);

    await userEvent.type(field('Serie 1, kilos'), '62,5');
    await userEvent.tab();
    await waitFor(async () => {
      expect((await setsOf(prensa.id))[0]?.weightKg).toBe(62.5);
    });

    expect(field('Serie 1, kilos')).toHaveValue('62,5'); // before the view catches up
  });

  it('después de guardar desde el campo, un cambio de fuera también aparece', async () => {
    await show(prensa.id);
    await userEvent.type(field('Serie 1, kilos'), '60');
    await userEvent.tab();
    await waitFor(async () => {
      expect((await setsOf(prensa.id))[0]?.weightKg).toBe(60);
    });
    const [first] = await setsOf(prensa.id);
    if (!first) throw new Error('set');

    await training.logSet(first.id, { weightKg: 75 });

    await waitFor(() => {
      expect(field('Serie 1, kilos')).toHaveValue('75');
    });
  });

  it('Enter también confirma', async () => {
    await show(prensa.id);
    await userEvent.type(field('Serie 1, repeticiones'), '10{Enter}');
    await waitFor(async () => {
      expect((await setsOf(prensa.id))[0]?.reps).toBe(10);
    });
  });

  it('sin cambios no se envía nada', async () => {
    await show(prensa.id);
    const logSet = vi.spyOn(training, 'logSet');

    await userEvent.click(field('Serie 1, kilos'));
    await userEvent.tab();

    expect(logSet).not.toHaveBeenCalled();
  });

  it('un valor inválido: motivo con su contexto, conserva lo escrito y no guarda (AC-19)', async () => {
    await show(prensa.id);

    await userEvent.type(field('Serie 1, kilos'), '60,1');
    await userEvent.tab();

    expect(await screen.findByText('weightKg/step/weight/false')).toBeVisible();
    expect(field('Serie 1, kilos')).toHaveValue('60,1');
    expect(field('Serie 1, kilos')).toHaveAttribute('aria-invalid', 'true');
    expect((await setsOf(prensa.id))[0]?.weightKg).toBeNull();
  });

  it('un cambio guardado desde fuera aparece solo si el campo no tiene el foco', async () => {
    await show(prensa.id);
    const [first] = await setsOf(prensa.id);
    if (!first) throw new Error('set');

    await training.logSet(first.id, { weightKg: 70 });

    await waitFor(() => {
      expect(field('Serie 1, kilos')).toHaveValue('70');
    });
  });
});

describe('marcar una serie (RN-TRN-04, 05, 11)', () => {
  it('sin reps: el motivo bajo la fila y el foco en las reps (AC-16)', async () => {
    await show(prensa.id);
    await userEvent.type(field('Serie 1, kilos'), '60');
    await userEvent.tab();
    await waitFor(async () => {
      expect((await setsOf(prensa.id))[0]?.weightKg).toBe(60);
    });

    await userEvent.click(check(1));

    expect(await screen.findByText('reps/missing/weight/false')).toBeVisible();
    expect(field('Serie 1, repeticiones')).toHaveFocus();
    expect(check(1)).not.toBeChecked();
  });

  it('marca la serie y la siguiente muestra el peso heredado (AC-13)', async () => {
    await show(prensa.id);
    await userEvent.type(field('Serie 1, kilos'), '60');
    await userEvent.type(field('Serie 1, repeticiones'), '10');
    await userEvent.tab();
    await waitFor(async () => {
      expect((await setsOf(prensa.id))[0]?.reps).toBe(10);
    });

    await userEvent.click(check(1));

    await waitFor(() => {
      expect(check(1)).toBeChecked();
    });
    expect(field('Serie 2, kilos')).toHaveValue('60');
  });
});

describe('anterior (RF-12, AC-29, AC-30)', () => {
  it('la misma serie de la última sesión completada, en cada métrica', async () => {
    const monday = await start('2026-11-16');
    const values: [ID, number, Partial<SetLog>][] = [
      [prensa.id, 1, { weightKg: 62.5, reps: 10 }],
      [dominadas.id, 1, { weightKg: -20, reps: 8 }],
      [plancha.id, 1, { reps: 40 }],
      [deadBug.id, 1, { reps: 10 }],
    ];
    for (const [exerciseId, n, v] of values) {
      const set = (await setsOf(exerciseId)).find((s) => s.setNumber === n);
      if (!set) throw new Error('set');
      await training.logSet(set.id, v);
      await training.toggleSetDone(set.id);
    }
    await db.table<Workout>('workouts').update(monday.id, { status: 'completed' });
    const saturday = await start('2026-11-21');

    for (const [exerciseId, text] of [
      [prensa.id, '62,5 × 10'],
      [dominadas.id, 'Asist. 20 × 8'],
      [plancha.id, '40 s'],
      [deadBug.id, '10'],
    ] as const) {
      const { unmount } = render(<Table workoutId={saturday.id} exerciseId={exerciseId} />);
      const rows = await screen.findAllByRole('row');
      await waitFor(() => {
        expect(within(must(rows[1])).getByText(text)).toBeVisible();
      });
      unmount();
    }
  });

  it('cada fila muestra su propia serie de la sesión anterior', async () => {
    const monday = await start('2026-11-16');
    for (const [n, reps] of [
      [1, 10],
      [2, 9],
    ] as const) {
      const set = (await setsOf(prensa.id)).find((x) => x.setNumber === n);
      if (!set) throw new Error('set');
      await training.logSet(set.id, { weightKg: 60, reps });
      await training.toggleSetDone(set.id);
    }
    await db.table<Workout>('workouts').update(monday.id, { status: 'completed' });

    await show(prensa.id, await start('2026-11-21'));

    const rows = screen.getAllByRole('row'); // header, then a set row and its problem row
    await waitFor(() => {
      expect(within(must(rows[3])).getByText('60 × 9')).toBeVisible();
    });
    expect(within(must(rows[1])).getByText('60 × 10')).toBeVisible();
  });

  it('sin sesión anterior → "—"', async () => {
    await show(prensa.id);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});

describe('Con asistencia (decisión 7)', () => {
  const assistance = () => screen.getByRole('switch', { name: 'Con asistencia' });

  it('solo en ejercicios de peso corporal con peso', async () => {
    await show(prensa.id);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('activado: "Asist. kg", escribir 20 guarda −20 y se ve 20 (AC-19b)', async () => {
    await show(dominadas.id);
    expect(assistance()).not.toBeChecked();

    await userEvent.click(assistance());
    expect(screen.getByRole('columnheader', { name: 'Asist. kg' })).toBeVisible();
    await userEvent.type(field('Serie 1, asistencia en kilos'), '20');
    await userEvent.tab();

    await waitFor(async () => {
      expect((await setsOf(dominadas.id))[0]?.weightKg).toBe(-20);
    });
    expect(field('Serie 1, asistencia en kilos')).toHaveValue('20');
  });

  it('las reps se guardan tal cual con la asistencia activada', async () => {
    await show(dominadas.id);
    await userEvent.click(assistance());

    await userEvent.type(field('Serie 1, repeticiones'), '8');
    await userEvent.tab();

    await waitFor(async () => {
      expect((await setsOf(dominadas.id))[0]?.reps).toBe(8);
    });
  });

  it('con la asistencia activada, las reps y el RIR se ven sin signo (solo el peso lo lleva)', async () => {
    await show(dominadas.id);
    await userEvent.click(assistance());
    for (const [name, value] of [
      ['Serie 1, asistencia en kilos', '20'],
      ['Serie 1, repeticiones', '8'],
      ['Serie 1, RIR', '2'],
    ] as const) {
      await userEvent.type(field(name), value);
      await userEvent.tab();
    }
    await waitFor(async () => {
      expect((await setsOf(dominadas.id))[0]).toMatchObject({ weightKg: -20, reps: 8, rir: 2 });
    });

    // Once the saved values are back in the view, not only while the draft is kept.
    await waitFor(() => {
      expect(field('Serie 1, repeticiones')).toHaveValue('8');
    });
    expect(field('Serie 1, RIR')).toHaveValue('2');
    expect(field('Serie 1, asistencia en kilos')).toHaveValue('20');
  });

  it('el error lleva el contexto de asistencia', async () => {
    await show(dominadas.id);
    await userEvent.click(assistance());

    await userEvent.type(field('Serie 1, asistencia en kilos'), '101');
    await userEvent.tab();

    expect(await screen.findByText('weightKg/out-of-range/weight/true')).toBeVisible();
  });

  it('arranca activado si una serie tiene peso negativo', async () => {
    await start();
    const [first] = await setsOf(dominadas.id);
    if (!first) throw new Error('set');
    await training.logSet(first.id, { weightKg: -15 });
    const workout = await training.getActiveWorkout();

    await show(dominadas.id, workout);

    expect(assistance()).toBeChecked();
    expect(field('Serie 1, asistencia en kilos')).toHaveValue('15');
  });

  it('al cambiarlo invierte el signo de las no hechas; las hechas no cambian', async () => {
    await start();
    const [first, second] = await setsOf(dominadas.id);
    if (!first || !second) throw new Error('sets');
    await training.logSet(first.id, { weightKg: -20, reps: 8 });
    await training.toggleSetDone(first.id); // second inherits −20
    const workout = await training.getActiveWorkout();
    await show(dominadas.id, workout);

    await userEvent.click(assistance());

    await waitFor(async () => {
      expect((await setsOf(dominadas.id)).map((s) => s.weightKg)).toEqual([-20, 20]);
    });
  });
});

describe('series extra (RF-16, RN-TRN-10)', () => {
  it('añadir hasta el máximo; la extra lleva "extra" (AC-31)', async () => {
    await show(prensa.id);

    await userEvent.click(screen.getByRole('button', { name: 'Añadir serie' }));

    expect(await screen.findByText('extra')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Máximo 3 series' })).toBeDisabled();
  });

  it('quitar quita la última serie (AC-32)', async () => {
    await show(prensa.id);

    await userEvent.click(screen.getByRole('button', { name: 'Quitar serie' }));

    await waitFor(async () => {
      expect(await setsOf(prensa.id)).toHaveLength(1);
    });
    // The view arrives after the write; the domain rejects a second tap anyway (RN-TRN-10).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Quitar serie' })).toBeDisabled(); // the only one
    });
  });

  it('quitar está deshabilitado si la última está hecha (AC-33)', async () => {
    await start();
    const sets = await setsOf(prensa.id);
    const last = sets.at(-1);
    if (!last) throw new Error('set');
    await training.logSet(last.id, { weightKg: 60, reps: 10 });
    await training.toggleSetDone(last.id);
    const workout = await training.getActiveWorkout();

    await show(prensa.id, workout);

    expect(screen.getByRole('button', { name: 'Quitar serie' })).toBeDisabled();
  });
});
