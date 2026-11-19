import 'fake-indexeddb/auto';
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RedFlag } from '@/modules/health';
import type { Workout } from '@/modules/training';
import { fixedClock, type Clock, type ID, type Instant, type LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import { closeTestDatabases, createTestServices, renderRoute } from './test-app';

// "Hoy" with done sessions and the pain notice (spec 005 AC-32 to AC-45; plan §6.7) over the real
// seed. Week 1 from Monday 2026-11-16: Mon Full body A, Tue cardio, Wed Full body B, Thu rest,
// Fri Full body A (3 workout days). Training and health share a clock the test moves, so each
// session has its own start and end and each pain entry its own recordedAt.

const date = (s: string) => s as LocalDate;

afterEach(async () => {
  vi.restoreAllMocks();
  await closeTestDatabases();
});

function movableClock(start: string) {
  let now = start;
  const clock: Clock = { now: () => now as Instant, today: () => now.slice(0, 10) as LocalDate };
  return {
    clock,
    set: (instant: string) => {
      now = instant;
    },
  };
}

/** Services where "Hoy" opens at `page`; training and health use the movable clock. */
async function setup(page = '2026-11-18T08:00:00-06:00') {
  const time = movableClock('2026-11-16T08:00:00-06:00');
  const services = createTestServices({ clock: fixedClock(page), seedClock: time.clock });
  await services.ready;
  return { services, time };
}

/** Marks every planned set of a workout, or only the first one. */
async function markSets(services: AppServices, workout: Workout, all: boolean) {
  const view = await services.training.getWorkoutView(workout.id);
  if (!view) throw new Error('no view');
  const sets = all ? view.sets : view.sets.slice(0, 1);
  for (const set of sets) {
    const metric = view.exercises[set.exerciseId]?.metric;
    await services.training.logSet(
      set.id,
      metric === 'weight' ? { weightKg: 40, reps: 10, rir: 3 } : { reps: 30, rir: 3 },
    );
    const marked = await services.training.toggleSetDone(set.id);
    if (!marked.ok) throw new Error(marked.error.code);
  }
}

/** Starts, logs, records pain and closes a session, as the Cierre does. */
async function closeSession(
  { services, time }: Awaited<ReturnType<typeof setup>>,
  opts: {
    on: string; // the day it is done
    plannedFor?: string;
    start?: string; // HH:MM
    end?: string;
    level?: number;
    redFlags?: RedFlag[];
    allSets?: boolean;
  },
) {
  time.set(`${opts.on}T${opts.start ?? '18:00'}:00-06:00`);
  const started = await services.training.startWorkout(date(opts.on), {
    plannedFor: date(opts.plannedFor ?? opts.on),
  });
  if (!started.ok) throw new Error(started.error.code);
  await markSets(services, started.value, opts.allSets ?? false);
  time.set(`${opts.on}T${opts.end ?? '18:52'}:00-06:00`);
  const recorded = await services.health.recordPain(started.value.id, {
    level: opts.level ?? 1,
    redFlags: opts.redFlags ?? [],
    date: started.value.date,
  });
  if (!recorded.ok) throw new Error(recorded.error.code);
  const finished = await services.training.finishWorkout(started.value.id, {});
  if (!finished.ok) throw new Error(finished.error.code);
  return finished.value;
}

/** Records pain entries in order, one hour apart (latest last), for workouts "Hoy" never reads. */
async function painHistory(
  { services, time }: Awaited<ReturnType<typeof setup>>,
  entries: { level: number; redFlags?: RedFlag[] }[],
) {
  for (const [i, { level, redFlags = [] }] of entries.entries()) {
    time.set(`2026-11-17T${String(10 + i).padStart(2, '0')}:00:00-06:00`);
    const result = await services.health.recordPain(`w-${String(i)}` as ID, {
      level,
      redFlags,
      date: date('2026-11-17'),
    });
    if (!result.ok) throw new Error(result.error.code);
  }
}

async function openToday(services: AppServices) {
  await renderRoute('/', services);
  return screen.findByRole('region', { name: /Tu sesión de hoy|Sesión en curso/ });
}

const card = () => screen.getByRole('region', { name: 'Tu sesión de hoy' });
const chipsOf = (region: HTMLElement) =>
  within(region)
    .queryAllByRole('listitem')
    .map((chip) => chip.textContent);
const dayLabel = (name: string) => screen.getByRole('img', { name: new RegExp(`^${name},`) });
const others = () => screen.getByRole('region', { name: 'Otra sesión de esta semana' });

describe('días hechos (AC-32 a AC-36)', () => {
  it('AC-32: el lunes guardado se ve hecho el miércoles: ✓, "1 de 3" y su fila gris sin enlace', async () => {
    const ctx = await setup();
    await closeSession(ctx, { on: '2026-11-16' });

    await openToday(ctx.services);

    expect(dayLabel('lunes')).toHaveAccessibleName('lunes, Full body A, hecha');
    expect(screen.getByText('1 de 3 sesiones')).toBeInTheDocument();
    const region = others();
    expect(within(region).getByText(/^Lun 16 · Full body A · hecha/)).toBeInTheDocument();
    expect(within(region).queryByRole('link', { name: /Lun 16/ })).not.toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Vie 20 · Full body A' })).toHaveAttribute(
      'href',
      '/dia/2026-11-20',
    );
  });

  it('AC-32: la fila hecha se lee "…, hecha" (el ✓ no se lee aparte)', async () => {
    const ctx = await setup();
    await closeSession(ctx, { on: '2026-11-16' });

    await openToday(ctx.services);

    const row = within(others()).getByText(/^Lun 16 · Full body A · hecha/);
    const hidden = row.querySelectorAll('[aria-hidden="true"]');
    expect([...hidden].map((node) => node.textContent)).toEqual(['✓']);
  });

  it('AC-33: el viernes hecho el miércoles marca el viernes, no el miércoles', async () => {
    const ctx = await setup('2026-11-18T20:00:00-06:00');
    await closeSession(ctx, { on: '2026-11-18', plannedFor: '2026-11-20' });

    await openToday(ctx.services);

    expect(dayLabel('viernes')).toHaveAccessibleName('viernes, Full body A, hecha');
    expect(dayLabel('miércoles')).toHaveAccessibleName('miércoles, hoy, Full body B, pendiente');
    expect(screen.getByText('1 de 3 sesiones')).toBeInTheDocument();
  });

  it('AC-34: el miércoles hecho ese día: tarjeta con "Hecha ✓", "52 min · N series" y sin CTA', async () => {
    const ctx = await setup('2026-11-18T20:00:00-06:00');
    const workout = await closeSession(ctx, { on: '2026-11-18', allSets: true });
    const sets = workout.items.reduce((n, item) => n + item.plannedSets, 0);

    await openToday(ctx.services);

    const region = card();
    expect(within(region).getByRole('heading', { level: 2, name: 'Full body B' })).toBeVisible();
    expect(chipsOf(region)).toContain('Hecha ✓');
    expect(within(region).getByText(`52 min · ${String(sets)} series`)).toBeVisible();
    expect(
      within(region).queryByRole('button', { name: 'Empezar sesión' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Ver (los \d+ ejercicios|el ejercicio)$/)).not.toBeInTheDocument();
    expect(dayLabel('miércoles')).toHaveAccessibleName('miércoles, hoy, Full body B, hecha');
  });

  it('AC-34: el ✓ del chip "Hecha" no se lee aparte', async () => {
    const ctx = await setup('2026-11-18T20:00:00-06:00');
    await closeSession(ctx, { on: '2026-11-18' });

    await openToday(ctx.services);

    const chip = within(card())
      .getAllByRole('listitem')
      .find((li) => li.textContent === 'Hecha ✓');
    expect(chip?.querySelector('[aria-hidden="true"]')?.textContent).toBe('✓');
  });

  it('AC-36: un workout descartado el lunes no cuenta como hecho', async () => {
    const ctx = await setup();
    ctx.time.set('2026-11-16T18:00:00-06:00');
    const started = await ctx.services.training.startWorkout(date('2026-11-16'));
    if (!started.ok) throw new Error(started.error.code);
    await ctx.services.training.discardWorkout(started.value.id);

    await openToday(ctx.services);

    expect(dayLabel('lunes')).toHaveAccessibleName('lunes, Full body A, no hecha');
    expect(screen.getByText('0 de 3 sesiones')).toBeInTheDocument();
    expect(within(others()).getByRole('link', { name: 'Lun 16 · Full body A' })).toBeVisible();
  });
});

describe('aviso de dolor y chip "Espalda" (AC-37 a AC-45)', () => {
  const noticeText = () => screen.queryByRole('note')?.textContent ?? null;
  const backChip = () =>
    within(card())
      .queryAllByRole('listitem')
      .find((li) => li.textContent.startsWith('Espalda'));

  it('AC-37: sin entradas de dolor, ni aviso ni chip', async () => {
    const ctx = await setup();

    await openToday(ctx.services);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(backChip()).toBeUndefined();
  });

  it('AC-38: la última en 3, sin nada más → chip "Espalda 3/10" sin ámbar y sin aviso', async () => {
    const ctx = await setup();
    await painHistory(ctx, [{ level: 3 }]);

    await openToday(ctx.services);

    expect(backChip()?.textContent).toBe('Espalda 3/10');
    expect(backChip()).not.toHaveAttribute('data-warn');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('AC-39: la última en 5 → aviso de atención arriba de la tarjeta y chip en ámbar', async () => {
    const ctx = await setup();
    await painHistory(ctx, [{ level: 5 }]);

    await openToday(ctx.services);

    expect(noticeText()).toBe(
      'Espalda baja 5/10 en la última sesión. Hoy baja la carga y evita los ejercicios que la provocaron.',
    );
    expect(backChip()?.textContent).toBe('Espalda 5/10');
    expect(backChip()).toHaveAttribute('data-warn');
    // Above the card: the notice comes first in the document.
    const note = screen.getByRole('note');
    expect(note.compareDocumentPosition(card()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('AC-40: 1, 2 y 3 → aviso de que el dolor subió', async () => {
    const ctx = await setup();
    await painHistory(ctx, [{ level: 1 }, { level: 2 }, { level: 3 }]);

    await openToday(ctx.services);

    expect(noticeText()).toBe(
      'Tu dolor lumbar subió en las 3 últimas sesiones (1 → 2 → 3). Hoy prioriza la técnica y no añadas carga.',
    );
  });

  it('AC-41: 4 y 5 → aviso de alerta persistente', async () => {
    const ctx = await setup();
    await painHistory(ctx, [{ level: 4 }, { level: 5 }]);

    await openToday(ctx.services);

    expect(noticeText()).toBe(
      'Espalda baja por encima de 3/10 en las 2 últimas sesiones. Hoy prioriza la técnica y no añadas carga; si sigue, consulta a tu traumatólogo o fisioterapeuta.',
    );
  });

  it('AC-42: la última en 8 → aviso de alerta', async () => {
    const ctx = await setup();
    await painHistory(ctx, [{ level: 8 }]);

    await openToday(ctx.services);

    expect(noticeText()).toBe(
      'Espalda baja 8/10 en la última sesión. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta.',
    );
  });

  it('AC-43: con "Debilidad en el pie", el aviso de la señal de alarma', async () => {
    const ctx = await setup();
    await painHistory(ctx, [{ level: 2, redFlags: ['weakness'] }]);

    await openToday(ctx.services);

    expect(noticeText()).toBe(
      'En la última sesión marcaste una señal de alarma. Consulta a un médico antes de seguir entrenando.',
    );
  });

  it('AC-43: con vejiga o intestino, el aviso de urgencias', async () => {
    const ctx = await setup();
    await painHistory(ctx, [{ level: 2, redFlags: ['bladder_bowel'] }]);

    await openToday(ctx.services);

    expect(noticeText()).toBe(
      'En la última sesión marcaste problemas de control de vejiga o intestino. Acude a urgencias antes de volver a entrenar.',
    );
  });

  it('AC-44: con una sesión en curso, ni aviso ni chip', async () => {
    const ctx = await setup();
    await painHistory(ctx, [{ level: 5 }]);
    ctx.time.set('2026-11-18T07:00:00-06:00');
    const started = await ctx.services.training.startWorkout(date('2026-11-18'));
    if (!started.ok) throw new Error(started.error.code);

    await openToday(ctx.services);

    expect(screen.getByRole('region', { name: 'Sesión en curso' })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Espalda \d+\/10$/)).not.toBeInTheDocument();
  });

  it('AC-45: tras 4 y 5, una sesión guardada con 2 quita el aviso; chip "Espalda 2/10"', async () => {
    const ctx = await setup();
    await painHistory(ctx, [{ level: 4 }, { level: 5 }]);
    await closeSession(ctx, { on: '2026-11-17', plannedFor: '2026-11-16', level: 2 });

    await openToday(ctx.services);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(backChip()?.textContent).toBe('Espalda 2/10');
  });

  it('plan §6.7: en un día de descanso también hay aviso y chip', async () => {
    const ctx = await setup('2026-11-19T08:00:00-06:00');
    await painHistory(ctx, [{ level: 6 }]);

    await openToday(ctx.services);

    expect(within(card()).getByRole('heading', { level: 2, name: 'Descanso' })).toBeVisible();
    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(backChip()?.textContent).toBe('Espalda 6/10');
  });

  it('plan §6.7: la tarjeta de un día hecho también lleva el chip "Espalda"', async () => {
    const ctx = await setup('2026-11-18T20:00:00-06:00');
    await closeSession(ctx, { on: '2026-11-18', level: 4 });

    await openToday(ctx.services);

    expect(chipsOf(card())).toEqual(expect.arrayContaining(['Hecha ✓', 'Espalda 4/10']));
  });
});

describe('carga', () => {
  it('plan §6.7: nada se pinta hasta que responden todas las consultas', async () => {
    const ctx = await setup();
    const { promise, resolve } = Promise.withResolvers<void>();
    const slow: AppServices = {
      ...ctx.services,
      health: {
        ...ctx.services.health,
        getPainSummary: async () => {
          await promise;
          return ctx.services.health.getPainSummary();
        },
      },
    };

    await renderRoute('/', slow);

    expect(screen.queryByRole('region', { name: 'Tu sesión de hoy' })).not.toBeInTheDocument();
    await act(async () => {
      resolve();
      await promise;
    });
    expect(await screen.findByRole('region', { name: 'Tu sesión de hoy' })).toBeInTheDocument();
  });
});
