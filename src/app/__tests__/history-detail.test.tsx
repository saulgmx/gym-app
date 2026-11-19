import 'fake-indexeddb/auto';
import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RedFlag } from '@/modules/health';
import type { SetLog, Workout } from '@/modules/training';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { closeTestDatabases, lastTestDatabase, renderRoute } from './test-app';
import { setup } from './test-sessions';

// The session detail (spec 006 AC-14 to AC-32, §6.2; plan §6.8) over the real seed. The program
// starts Monday 2026-11-16 and pages open on Wednesday 25. Sessions are written through the API
// with exact values per set (spec §4):
//   L16: Full body A with Jalón al pecho instead of Dominadas, every set done, 18:00 → 18:52,
//        pain 2, two-line notes.
//   M18: Full body A of Friday 20, done on Wednesday 18: Prensa 1-2, Press de banca 1 and
//        Dominadas 1-2 (the first assisted), 18:00 → 18:30, pain 5 with "Hormigueo".
//   L23: Full body B of week 2, every set done plus an extra Fondos en paralelas, pain 3.

const date = (s: string) => s as LocalDate;
const WEDNESDAY_25 = '2026-11-25T08:00:00-06:00';
const NOTES = 'Buena sesión\nSin molestias en la rodilla';

interface Values {
  weightKg?: number;
  reps: number;
  rir: number;
}
type Ctx = Awaited<ReturnType<typeof setup>>;

beforeEach(() => {
  document.head.innerHTML = '<title>Gym</title>';
});

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

/** Starts, logs exact values, records pain and closes a session; `values` undefined = not done. */
async function session(
  { services, time }: Ctx,
  opts: {
    on: string;
    plannedFor?: string;
    end: string;
    choose?: [string, string];
    extra?: string;
    values: (exercise: string, setNumber: number) => Values | undefined;
    level: number;
    redFlags?: RedFlag[];
    notes?: string;
  },
) {
  const { training, health } = services;
  time.set(`${opts.on}T18:00:00-06:00`);
  const started = await training.startWorkout(date(opts.on), {
    plannedFor: date(opts.plannedFor ?? opts.on),
  });
  if (!started.ok) throw new Error(started.error.code);
  const id = started.value.id;
  const idOf = async (name: string) => {
    const view = await training.getWorkoutView(id);
    const found = Object.values(view?.exercises ?? {}).find((e) => e.name === name);
    if (!found) throw new Error(`no exercise ${name}`);
    return found.id;
  };
  if (opts.choose) {
    const [from, to] = opts.choose;
    const chosen = await training.chooseExercise(id, await idOf(from), await idOf(to));
    if (!chosen.ok) throw new Error(chosen.error.code);
  }
  if (opts.extra) {
    const added = await training.addExtraSet(id, await idOf(opts.extra));
    if (!added.ok) throw new Error(added.error.code);
  }
  const view = await training.getWorkoutView(id);
  for (const set of view?.sets ?? []) {
    const name = view?.exercises[set.exerciseId]?.name ?? '';
    const values = opts.values(name, set.setNumber);
    if (!values) continue;
    const logged = await training.logSet(set.id, { weightKg: null, ...values });
    if (!logged.ok) throw new Error(`${name} ${String(set.setNumber)}: ${logged.error.code}`);
    const done = await training.toggleSetDone(set.id);
    if (!done.ok) throw new Error(done.error.code);
  }
  time.set(`${opts.on}T${opts.end}:00-06:00`);
  const pain = await health.recordPain(id, {
    level: opts.level,
    redFlags: opts.redFlags ?? [],
    date: started.value.date,
  });
  if (!pain.ok) throw new Error(pain.error.code);
  const finished = await training.finishWorkout(id, opts.notes ? { notes: opts.notes } : {});
  if (!finished.ok) throw new Error(finished.error.code);
  return finished.value;
}

const weighted = { weightKg: 40, reps: 10, rir: 2 };

async function examples() {
  const ctx = await setup(WEDNESDAY_25);
  const l16 = await session(ctx, {
    on: '2026-11-16',
    end: '18:52',
    choose: ['Dominadas', 'Jalón al pecho'],
    values: (name, n) => {
      if (name === 'Prensa de piernas') return { weightKg: 100, reps: n === 1 ? 10 : 9, rir: 2 };
      if (name === 'Dead bug') return { reps: 12, rir: 1 };
      return weighted;
    },
    level: 2,
    notes: NOTES,
  });
  const m18 = await session(ctx, {
    on: '2026-11-18',
    plannedFor: '2026-11-20',
    end: '18:30',
    values: (name, n) => {
      if (name === 'Prensa de piernas') return weighted;
      if (name === 'Press de banca con barra' && n === 1) return weighted;
      if (name === 'Dominadas') return n === 1 ? { weightKg: -20, reps: 8, rir: 2 } : weighted;
      return undefined;
    },
    level: 5,
    redFlags: ['numbness'],
  });
  const l23 = await session(ctx, {
    on: '2026-11-23',
    end: '18:45',
    extra: 'Fondos en paralelas',
    values: (name, n) =>
      name === 'Fondos en paralelas'
        ? { weightKg: 0, reps: n === 3 ? 8 : 10, rir: n === 3 ? 1 : 2 }
        : weighted,
    level: 3,
  });
  return { ...ctx, l16, m18, l23 };
}

const open = async (ctx: Ctx, workout: Workout, state?: unknown) => {
  const path = `/historial/${workout.id}`;
  const router = await renderRoute(
    state === undefined ? path : { pathname: path, state },
    ctx.services,
  );
  await screen.findByRole('heading', { level: 1, name: workout.name });
  return router;
};

const region = (name: string) => screen.getByRole('region', { name });
const itemOf = (exercise: string) => {
  const heading = within(region('Ejercicios')).getByRole('heading', { level: 3, name: exercise });
  const item = heading.closest('li');
  if (!item) throw new Error(`no item ${exercise}`);
  return item;
};
const setLines = (exercise: string) =>
  within(itemOf(exercise))
    .queryAllByRole('listitem')
    .map((li) => li.textContent);

describe('detalle de una sesión', () => {
  it('spec 006 AC-14: encabezado, título del documento y "Volver"', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l16);

    expect(screen.getByRole('heading', { level: 1, name: 'Full body A' })).toBeVisible();
    expect(screen.getByText('Lunes 16 de noviembre · Semana 1')).toBeVisible();
    expect(document.title).toBe('Full body A · Historial · Gym');
    expect(screen.getByRole('link', { name: 'Volver' })).toBeVisible();
  });

  it('spec 006 AC-15: una sesión de otro día del plan dice de cuál', async () => {
    const ctx = await examples();
    await open(ctx, ctx.m18);

    expect(
      screen.getByText('Miércoles 18 de noviembre · Semana 1 · sesión del viernes'),
    ).toBeVisible();
  });

  it('spec 006 AC-16: las tres cifras del resumen de una sesión completa', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l16);
    const figures = () =>
      screen.getAllByRole('definition').map((d) => d.textContent.replace(/\s+/g, ' '));

    expect(figures()).toEqual(['52 min', '10 series', '7 ejercicios']);
  });

  it('spec 006 AC-16: resumen de una sesión parcial', async () => {
    const ctx = await examples();
    await open(ctx, ctx.m18);

    expect(
      screen.getAllByRole('definition').map((d) => d.textContent.replace(/\s+/g, ' ')),
    ).toEqual(['30 min', '5 series', '3 de 7 ejercicios']);
  });

  it('spec 006 AC-17: dolor sin señales', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l16);
    const pain = region('Dolor lumbar');

    expect(within(pain).getByText('2/10')).not.toHaveAttribute('data-warn');
    expect(within(pain).queryByText(/Señales de alarma/)).not.toBeInTheDocument();
  });

  it('spec 006 AC-18: dolor en ámbar y señales marcadas, sin los consejos', async () => {
    const ctx = await examples();
    await open(ctx, ctx.m18);
    const pain = region('Dolor lumbar');

    expect(within(pain).getByText('5/10')).toHaveAttribute('data-warn');
    expect(within(pain).getByText('Señales de alarma: Hormigueo o adormecimiento')).toBeVisible();
    expect(screen.queryByText(/Baja la carga/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Consulta a un médico/)).not.toBeInTheDocument();
  });

  it('spec 006 AC-19: los 7 ejercicios en el orden de la sesión', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l16);

    expect(
      within(region('Ejercicios'))
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([
      'Prensa de piernas',
      'Press de banca con barra',
      'Jalón al pecho',
      'Curl femoral',
      'Elevaciones laterales',
      'Curl con barra Z',
      'Dead bug',
    ]);
  });

  it('spec 006 AC-20: las series hechas en orden, con coma decimal si la hay', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l16);

    expect(setLines('Prensa de piernas')).toEqual(['1 · 100 × 10 · RIR 2', '2 · 100 × 9 · RIR 2']);
  });

  it('spec 006 AC-21: la alternativa elegida dice a cuál reemplaza', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l16);

    expect(within(itemOf('Jalón al pecho')).getByText('En lugar de Dominadas')).toBeVisible();
    expect(within(itemOf('Prensa de piernas')).queryByText(/En lugar de/)).not.toBeInTheDocument();
  });

  it('spec 006 AC-22: la serie extra lleva su marca', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l23);

    expect(setLines('Fondos en paralelas')).toEqual([
      '1 · 0 × 10 · RIR 2',
      '2 · 0 × 10 · RIR 2',
      '3 · 0 × 8 · RIR 1 · Extra',
    ]);
  });

  it('spec 006 AC-23: una serie con asistencia', async () => {
    const ctx = await examples();
    await open(ctx, ctx.m18);

    expect(setLines('Dominadas')).toEqual(['1 · Asist. 20 × 8 · RIR 2', '2 · 40 × 10 · RIR 2']);
  });

  it('spec 006 AC-24: un ejercicio por repeticiones muestra solo las reps', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l16);

    expect(setLines('Dead bug')).toEqual(['1 · 12 · RIR 1']);
  });

  it('spec 006 AC-24: un ejercicio por tiempo muestra los segundos', async () => {
    const ctx = await examples();
    // Block 1 has no timed exercise, so the session is written directly with the seed's Plancha.
    const catalog = await lastTestDatabase().table<{ id: ID; name: string }>('exercises').toArray();
    const planchaId = catalog.find((e) => e.name === 'Plancha')?.id;
    const [first] = ctx.l16.items;
    if (!planchaId || !first) throw new Error('no Plancha in the seed');
    const workout: Workout = {
      ...ctx.l16,
      id: 'plancha' as ID,
      date: date('2026-11-24'),
      plannedFor: date('2026-11-24'),
      startedAt: '2026-11-24T18:00:00-06:00' as Instant,
      finishedAt: '2026-11-24T18:20:00-06:00' as Instant,
      items: [{ ...first, exerciseId: planchaId, options: [planchaId] }],
    };
    const set: SetLog = {
      id: 'plancha-1' as ID,
      workoutId: workout.id,
      exerciseId: planchaId,
      setNumber: 1,
      weightKg: null,
      reps: 40,
      rir: 2,
      done: true,
      isExtra: false,
    };
    await lastTestDatabase().table('workouts').add(workout);
    await lastTestDatabase().table('sets').add(set);
    await open(ctx, workout);

    expect(setLines('Plancha')).toEqual(['1 · 40 s · RIR 2']);
  });

  it('spec 006 AC-25: los ejercicios sin series hechas salen con "Sin series"', async () => {
    const ctx = await examples();
    await open(ctx, ctx.m18);

    for (const name of ['Curl femoral', 'Elevaciones laterales', 'Curl con barra Z', 'Dead bug']) {
      const item = itemOf(name);
      expect(within(item).getByText('Sin series')).toBeVisible();
      expect(within(item).getByRole('heading', { level: 3 })).toHaveAttribute('data-empty');
    }
    expect(setLines('Press de banca con barra')).toEqual(['1 · 40 × 10 · RIR 2']);
  });

  it('spec 006 AC-26: las notas con sus saltos de línea; sin notas no hay sección', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l16);
    expect(within(region('Notas')).getByText(/Buena sesión/).textContent).toBe(NOTES);
  });

  it('spec 006 AC-26: sin notas, la sección no sale', async () => {
    const ctx = await examples();
    await open(ctx, ctx.m18);
    expect(screen.queryByRole('region', { name: 'Notas' })).not.toBeInTheDocument();
  });

  it.each([
    ['AC-27: desde la lista, "Volver" lleva a la lista', { from: '/historial' }, '/historial'],
    ['AC-28: desde "Hoy", "Volver" lleva a "Hoy"', { from: '/' }, '/'],
    ['AC-29: escribiendo la URL, "Volver" lleva a la lista', undefined, '/historial'],
    [
      'AC-29: con un origen ajeno a la app, "Volver" lleva a la lista',
      { from: '/sesion/x' },
      '/historial',
    ],
  ])('spec 006 %s', async (_, state, href) => {
    const ctx = await examples();
    await open(ctx, ctx.l16, state);

    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', href);
  });

  it.each(['no-existe', 'discarded', 'in_progress'] as const)(
    'spec 006 AC-30: %s no está en el historial',
    async (kind) => {
      const ctx = await setup(WEDNESDAY_25);
      const { training } = ctx.services;
      ctx.time.set('2026-11-23T18:00:00-06:00');
      let id = 'no-existe';
      if (kind !== 'no-existe') {
        const started = await training.startWorkout(date('2026-11-23'));
        if (!started.ok) throw new Error(started.error.code);
        if (kind === 'discarded') await training.discardWorkout(started.value.id);
        id = started.value.id;
      }
      await renderRoute(`/historial/${id}`, ctx.services);

      expect(await screen.findByText('Esta sesión no está en el historial.')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Ver el historial' })).toHaveAttribute(
        'href',
        '/historial',
      );
      expect(document.title).toBe('Historial · Gym');
    },
  );

  it('spec 006 AC-31: no hay controles para cambiar la sesión', async () => {
    const ctx = await examples();
    await open(ctx, ctx.l16);
    const main = screen.getByRole('main');

    for (const role of ['textbox', 'checkbox', 'spinbutton', 'button'] as const) {
      expect(within(main).queryAllByRole(role)).toEqual([]);
    }
  });

  it('spec 006 AC-32: una sesión cerrada sin entrada de dolor dice "Sin registro"', async () => {
    const ctx = await examples();
    const broken: Workout = { ...ctx.l16, id: 'sin-dolor' as ID };
    await lastTestDatabase().table('workouts').add(broken);
    await open(ctx, broken);

    expect(within(region('Dolor lumbar')).getByText('Sin registro')).toBeVisible();
  });

  it('spec 006 §8 decisión 10: fuera del programa, en lugar de "Semana N"', async () => {
    const ctx = await examples();
    const outside: Workout = { ...ctx.l16, id: 'fuera' as ID, programWeek: null };
    await lastTestDatabase().table('workouts').add(outside);
    await open(ctx, outside);

    expect(screen.getByText('Lunes 16 de noviembre · Fuera del programa')).toBeVisible();
  });
});
