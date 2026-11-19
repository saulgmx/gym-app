import { describe, expect, it, vi } from 'vitest';
import { err, fixedClock, ok, type Clock, type ID, type LocalDate } from '@/shared/kernel';
import type { PlanRepository, SeedParser } from '../application/ports';
import { createPlanService } from '../application/service';
import { getDayPlan, getPosition, getWeekPlan, type PlanSnapshot } from '../domain/schedule';
import type { Exercise, PlanError, PlanSeed } from '../domain/types';

// Application service with an in-memory repository, no Dexie (QS-08).
// Small 2-week program; dates checked with Node: 2026-11-16 Monday, 18 Wednesday, 22 Sunday.

const date = (s: string) => s as LocalDate;
const id = (s: string) => s as ID;

const exercise = (key: string, overrides: Partial<Exercise> = {}): Exercise => ({
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

const seed = (): PlanSeed => ({
  exercises: [
    exercise('prensa', { name: 'Prensa de piernas', isPrimary: true }),
    exercise('jalon', { name: 'Jalón al pecho', muscleGroup: 'back', equipment: 'cable' }),
  ],
  program: { id: id('program'), name: 'Prueba', totalWeeks: 2, blockIds: [id('b1')] },
  blocks: [
    {
      id: id('b1'),
      programId: id('program'),
      name: 'Bloque 1',
      startWeek: 1,
      endWeek: 2,
      targetRir: [2, 3],
      weekFactors: {},
      isDeload: false,
      schedule: [
        { weekday: 1, kind: 'workout', templateId: id('tpl-a') },
        { weekday: 2, kind: 'cardio', note: 'Cardio suave' },
        { weekday: 3, kind: 'rest' },
        { weekday: 4, kind: 'rest' },
        { weekday: 5, kind: 'rest' },
        { weekday: 6, kind: 'rest' },
        { weekday: 0, kind: 'rest' },
      ],
    },
  ],
  templates: [
    {
      id: id('tpl-a'),
      blockId: id('b1'),
      name: 'Full body A',
      items: [{ exerciseId: id('prensa'), order: 1, sets: [3, 3], reps: [8, 12] }],
    },
  ],
});

const snapshotFrom = (s: PlanSeed, startDate: string): PlanSnapshot => ({
  exercises: s.exercises,
  program: { ...s.program, startDate: date(startDate) },
  blocks: s.blocks,
  templates: s.templates,
});

const loaded = () => snapshotFrom(seed(), '2026-11-16');

// The real repository checks "empty" and writes in one transaction (RN-PLN-14).
function memoryRepository(initial?: PlanSnapshot) {
  const state = { stored: initial };
  const repository = {
    loadSnapshot: vi.fn(() => Promise.resolve(state.stored)),
    seedIfEmpty: vi.fn((snapshot: PlanSnapshot) => {
      state.stored ??= snapshot;
      return Promise.resolve();
    }),
  } satisfies PlanRepository;
  return { repository, state };
}

const passthrough: SeedParser = (raw) => ok(raw as PlanSeed);

const wednesday = fixedClock('2026-11-18T08:00:00-06:00');

function setup(options: { initial?: PlanSnapshot; parser?: SeedParser; clock?: Clock } = {}) {
  const { repository, state } = memoryRepository(options.initial);
  const service = createPlanService({
    repository,
    parser: options.parser ?? passthrough,
    clock: options.clock ?? wednesday,
  });
  return { service, repository, state };
}

describe('ensureSeeded', () => {
  it('base vacía y seed válido → ok y escribe el seed con su startDate', async () => {
    const { service, state } = setup();

    expect(await service.ensureSeeded(seed())).toEqual({ ok: true, value: undefined });
    expect(state.stored).toEqual(loaded());
  });

  it('pasa la entrada tal cual al parser', async () => {
    const parser = vi.fn(passthrough);
    const { service } = setup({ parser });
    const raw = seed();

    await service.ensureSeeded(raw);

    expect(parser).toHaveBeenCalledExactlyOnceWith(raw);
  });

  describe('RN-PLN-13: startDate = lunes de la semana de clock.today()', () => {
    it.each([
      ['miércoles 2026-11-18', '2026-11-18T08:00:00-06:00'],
      ['lunes 2026-11-16', '2026-11-16T08:00:00-06:00'],
      ['domingo 2026-11-22', '2026-11-22T23:30:00-06:00'],
    ])('primer arranque el %s → 2026-11-16', async (_, now) => {
      const { service, state } = setup({ clock: fixedClock(now) });

      await service.ensureSeeded(seed());

      expect(state.stored?.program.startDate).toBe('2026-11-16');
    });

    it('lee clock.today() al llamar a ensureSeeded, no al crear el servicio', async () => {
      let today = date('2026-11-18');
      const clock: Clock = { now: () => wednesday.now(), today: () => today };
      const { service, state } = setup({ clock });

      today = date('2026-11-25');
      await service.ensureSeeded(seed());

      expect(state.stored?.program.startDate).toBe('2026-11-23');
    });
  });

  describe('RN-PLN-20: parser, reglas y escritura, en ese orden', () => {
    it('parser que falla → devuelve su error sin validar ni escribir', async () => {
      const parseError: PlanError = { code: 'plan/invalid-seed', message: 'bad shape' };
      const { service, repository } = setup({ parser: () => err(parseError) });
      // Raw input that would also break the rules: the parser's error must win.
      const raw = seed();
      raw.exercises.push(exercise('peso-muerto-rumano', { lumbarRisk: 'high' }));

      const result = await service.ensureSeeded(raw);

      expect(result).toEqual({ ok: false, error: parseError });
      expect(repository.seedIfEmpty).not.toHaveBeenCalled();
    });

    it('seed con un ejercicio high → plan/high-risk-exercise sin escribir (RN-PLN-07)', async () => {
      const { service, repository, state } = setup();
      const raw = seed();
      raw.exercises.push(exercise('peso-muerto-rumano', { lumbarRisk: 'high' }));

      const result = await service.ensureSeeded(raw);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('plan/high-risk-exercise');
      expect(repository.seedIfEmpty).not.toHaveBeenCalled();
      expect(state.stored).toBeUndefined();
    });

    it('seed con una referencia rota → plan/invalid-seed sin escribir (RN-PLN-15)', async () => {
      const { service, repository } = setup();
      const raw = seed();
      raw.templates = raw.templates.map((t) => ({
        ...t,
        items: t.items.map((item) => ({ ...item, exerciseId: id('no-existe') })),
      }));

      const result = await service.ensureSeeded(raw);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('plan/invalid-seed');
      expect(repository.seedIfEmpty).not.toHaveBeenCalled();
    });

    it('programa ya cargado y seed inválido → devuelve el error y la base no cambia', async () => {
      const { service, repository, state } = setup({ initial: loaded() });
      const raw = seed();
      raw.exercises.push(exercise('peso-muerto-rumano', { lumbarRisk: 'high' }));

      const result = await service.ensureSeeded(raw);

      expect(result.ok).toBe(false);
      expect(repository.seedIfEmpty).not.toHaveBeenCalled();
      expect(state.stored).toEqual(loaded());
    });
  });

  it('RN-PLN-14: programa ya cargado y seed válido → ok y no cambia startDate ni las tablas', async () => {
    const { service, state } = setup({
      initial: loaded(),
      clock: fixedClock('2026-12-02T08:00:00-06:00'),
    });

    expect(await service.ensureSeeded(seed())).toEqual({ ok: true, value: undefined });
    expect(state.stored).toEqual(loaded());
  });

  it('RN-PLN-21: el repositorio rechaza al escribir → ensureSeeded rechaza', async () => {
    const { service, repository } = setup();
    const failure = new Error('QuotaExceededError');
    repository.seedIfEmpty.mockRejectedValueOnce(failure);

    await expect(service.ensureSeeded(seed())).rejects.toBe(failure);
  });
});

describe('consultas sobre el repositorio', () => {
  const monday = date('2026-11-16');
  const tuesday = date('2026-11-17');
  const thursday = date('2026-11-19');

  it('getPosition → la del dominio con el programa guardado', async () => {
    const { service } = setup({ initial: loaded() });

    const position = await service.getPosition(date('2026-11-25'));

    expect(position).toEqual(getPosition(loaded(), date('2026-11-25')));
    expect(position).toMatchObject({ status: 'active', week: 2 });
  });

  it('getTodayPlan → pesas el lunes y cardio con su nota el martes', async () => {
    const { service } = setup({ initial: loaded() });

    const mondayPlan = await service.getTodayPlan(monday);
    expect(mondayPlan).toEqual(getDayPlan(loaded(), monday));
    expect(mondayPlan.kind === 'workout' && mondayPlan.template.name).toBe('Full body A');

    expect(await service.getTodayPlan(tuesday)).toMatchObject({
      kind: 'cardio',
      note: 'Cardio suave',
    });
  });

  it('getWeekPlan con un jueves → 7 días desde el lunes (RN-PLN-10)', async () => {
    const { service } = setup({ initial: loaded() });

    const week = await service.getWeekPlan(thursday);

    expect(week).toEqual(getWeekPlan(loaded(), thursday));
    expect(week.map((d) => d.kind)).toEqual([
      'workout',
      'cardio',
      'rest',
      'rest',
      'rest',
      'rest',
      'rest',
    ]);
  });

  it('las consultas ven el programa recién cargado por ensureSeeded', async () => {
    const { service } = setup();

    await service.ensureSeeded(seed());

    expect(await service.getTodayPlan(monday)).toEqual(getDayPlan(loaded(), monday));
  });

  it('RN-PLN-22: sin programa cargado, las consultas lanzan', async () => {
    const { service } = setup();

    await expect(service.getPosition(monday)).rejects.toThrow(/RN-PLN-22/);
    await expect(service.getTodayPlan(monday)).rejects.toThrow(/RN-PLN-22/);
    await expect(service.getWeekPlan(monday)).rejects.toThrow(/RN-PLN-22/);
  });

  it('getExercise → el ejercicio del catálogo, o undefined si no existe', async () => {
    const { service } = setup({ initial: loaded() });

    expect(await service.getExercise(id('jalon'))).toEqual(seed().exercises[1]);
    expect(await service.getExercise(id('no-existe'))).toBeUndefined();
  });

  it('getExercises → uno por ID pedido, en su orden, sin los que no existen', async () => {
    const { service } = setup({ initial: loaded() });
    const [prensa, jalon] = seed().exercises;

    const found = await service.getExercises([
      id('jalon'),
      id('no-existe'),
      id('prensa'),
      id('jalon'),
    ]);

    expect(found).toEqual([jalon, prensa, jalon]);
    expect(await service.getExercises([])).toEqual([]);
  });

  it('RN-PLN-22: sin programa cargado, getExercise y getExercises lanzan', async () => {
    const { service } = setup();

    await expect(service.getExercise(id('prensa'))).rejects.toThrow(/RN-PLN-22/);
    await expect(service.getExercises([id('prensa')])).rejects.toThrow(/RN-PLN-22/);
  });

  it('getBlocks → los bloques del programa ordenados por startWeek (RN-PLN-28)', async () => {
    const [b1] = loaded().blocks;
    if (!b1) throw new Error('fixture without blocks');
    const b2 = { ...b1, id: id('b2'), name: 'Bloque 2', startWeek: 3, endWeek: 4 };
    const b3 = { ...b1, id: id('b3'), name: 'Descarga', startWeek: 5, endWeek: 5 };
    // The store reads blocks by programId, in no particular order (RN-PLN-25).
    const { service } = setup({ initial: { ...loaded(), blocks: [b3, b1, b2] } });

    expect((await service.getBlocks()).map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('RN-PLN-22: sin programa cargado, getBlocks lanza', async () => {
    const { service } = setup();

    await expect(service.getBlocks()).rejects.toThrow(/RN-PLN-22/);
  });

  it('RN-PLN-23: sin caché, la siguiente consulta refleja un cambio en el repositorio', async () => {
    const { service, state } = setup({ initial: loaded() });
    expect(await service.getPosition(date('2026-11-18'))).toMatchObject({ status: 'active' });

    state.stored = snapshotFrom(seed(), '2026-11-23');

    expect(await service.getPosition(date('2026-11-18'))).toMatchObject({
      status: 'not_started',
    });
  });

  it('RN-PLN-21: el repositorio rechaza al leer → la consulta rechaza', async () => {
    const { service, repository } = setup({ initial: loaded() });
    const failure = new Error('UnknownError');
    repository.loadSnapshot.mockRejectedValueOnce(failure);

    await expect(service.getTodayPlan(monday)).rejects.toBe(failure);
  });
});
