import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { fixedClock, type LocalDate } from '@/shared/kernel';
import { createPlan, planStores } from '..';
import { BLOCK, PALLOF, PRENSA, uuid, valid } from './fixtures/seed';

// Integration through the public API with IndexedDB in memory (AC-1 to AC-3, AC-5, AC-6,
// RN-PLN-14, 25). Each test opens its own database, as app/db.ts will (plan §6.9).

const TABLES = ['exercises', 'programs', 'blocks', 'templates'] as const;
const wednesday = fixedClock('2026-11-18T08:00:00-06:00'); // week 1 starts Monday 2026-11-16
const date = (s: string) => s as LocalDate;

const opened: Dexie[] = [];

function openDb(name: string = crypto.randomUUID()): Dexie {
  const db = new Dexie(name);
  db.version(1).stores(planStores);
  opened.push(db);
  return db;
}

afterEach(async () => {
  const names = new Set(opened.map((db) => db.name));
  for (const db of opened.splice(0)) db.close();
  await Promise.all([...names].map((name) => Dexie.delete(name)));
});

async function dump(db: Dexie) {
  const rows = await Promise.all(TABLES.map((t) => db.table(t).toArray()));
  return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]]));
}

const emptyDump = Object.fromEntries(TABLES.map((t) => [t, []]));

// What the tables hold after a valid seed on the Wednesday (RN-PLN-25: domain objects as they are).
const seededDump = () => {
  const seed = valid();
  return {
    exercises: seed.exercises,
    programs: [{ ...seed.program, startDate: '2026-11-16' }],
    blocks: seed.blocks,
    templates: seed.templates,
  };
};

type RawSeed = ReturnType<typeof valid>;

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Fixture element missing');
  return value;
}
const block0 = (s: RawSeed) => must(s.blocks[0]);
const item = (s: RawSeed, i: number) => must(must(s.templates[0]).items[i]);
const exercise = (s: RawSeed, i: number) => must(s.exercises[i]);

function seedWith(mutate: (seed: RawSeed) => void): RawSeed {
  const seed = valid();
  mutate(seed);
  return seed;
}

describe('ensureSeeded con IndexedDB', () => {
  it('AC-1: base vacía un miércoles → carga el seed con startDate del lunes y "Hoy" lo usa', async () => {
    const db = openDb();
    const plan = createPlan({ db, clock: wednesday });

    expect(await plan.ensureSeeded(valid())).toEqual({ ok: true, value: undefined });

    expect(await dump(db)).toEqual(seededDump());
    const today = await plan.getTodayPlan(date('2026-11-18'));
    expect(today).toMatchObject({
      kind: 'workout',
      position: { status: 'active', week: 1, block: { name: 'Bloque 1 · Full body' } },
      template: { name: 'Full body B' },
    });
  });

  it('AC-2: reabrir la app otro día no cambia startDate ni las tablas', async () => {
    const name = crypto.randomUUID();
    const first = openDb(name);
    await createPlan({ db: first, clock: wednesday }).ensureSeeded(valid());
    const before = await dump(first);
    first.close();

    const reopened = openDb(name);
    const plan = createPlan({ db: reopened, clock: fixedClock('2026-12-02T08:00:00-06:00') });

    expect(await plan.ensureSeeded(valid())).toEqual({ ok: true, value: undefined });
    expect(await dump(reopened)).toEqual(before);
  });

  it('AC-3: dos ensureSeeded a la vez sobre la misma conexión → un solo programa', async () => {
    const db = openDb();
    const plan = createPlan({ db, clock: wednesday });

    const results = await Promise.all([plan.ensureSeeded(valid()), plan.ensureSeeded(valid())]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(await dump(db)).toEqual(seededDump());
  });

  it('AC-3: dos conexiones a la misma base (dos pestañas) → un solo programa', async () => {
    const name = crypto.randomUUID();
    const tabA = openDb(name);
    const tabB = openDb(name);

    const results = await Promise.all([
      createPlan({ db: tabA, clock: wednesday }).ensureSeeded(valid()),
      createPlan({ db: tabB, clock: wednesday }).ensureSeeded(valid()),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(await dump(tabA)).toEqual(seededDump());
  });

  describe('AC-5: seed inválido → plan/invalid-seed y la base vacía', () => {
    it.each<[string, (seed: RawSeed) => void]>([
      ['forma inválida (esquema)', (s) => void (item(s, 0).sets = [3, 2])],
      ['referencia inexistente', (s) => void (item(s, 0).exerciseId = uuid(99))],
      ['semanas con hueco', (s) => void (s.program.totalWeeks = 3)],
      [
        'semanas con solape',
        (s) => {
          s.blocks.push({
            ...block0(s),
            id: uuid(21),
            startWeek: 2,
            endWeek: 2,
            weekRir: {},
            weekFactors: {},
          });
          s.program.blockIds.push(uuid(21));
        },
      ],
      ['día sin entrada', (s) => void block0(s).schedule.splice(4, 1)],
      ['día duplicado', (s) => void block0(s).schedule.push({ weekday: 4, kind: 'rest' })],
      ['paridad incompleta', (s) => void block0(s).schedule.splice(1, 1)],
      ['alternativa con otra métrica', (s) => void (item(s, 1).alternatives = [PRENSA])],
      ['alternativa repetida', (s) => void (item(s, 1).alternatives = [PALLOF, PALLOF])],
    ])('%s', async (_, mutate) => {
      const db = openDb();
      const result = await createPlan({ db, clock: wednesday }).ensureSeeded(seedWith(mutate));

      expect(result).toMatchObject({ ok: false, error: { code: 'plan/invalid-seed' } });
      expect(await dump(db)).toEqual(emptyDump);
    });
  });

  describe('AC-6: ejercicio high → plan/high-risk-exercise y la base vacía', () => {
    it.each<[string, (seed: RawSeed) => void]>([
      ['como principal', (s) => void (exercise(s, 0).lumbarRisk = 'high')],
      ['como alternativa', (s) => void (exercise(s, 2).lumbarRisk = 'high')],
    ])('%s', async (_, mutate) => {
      const db = openDb();
      const result = await createPlan({ db, clock: wednesday }).ensureSeeded(seedWith(mutate));

      expect(result).toMatchObject({ ok: false, error: { code: 'plan/high-risk-exercise' } });
      expect(await dump(db)).toEqual(emptyDump);
    });
  });

  describe('RN-PLN-14: escritura atómica', () => {
    it('un fallo a mitad de la escritura → rechaza y las 4 tablas quedan vacías', async () => {
      const db = openDb();
      const failure = new Error('write failed');
      db.table('templates').hook('creating', () => {
        throw failure;
      });

      await expect(createPlan({ db, clock: wednesday }).ensureSeeded(valid())).rejects.toThrow(
        'write failed',
      );
      expect(await dump(db)).toEqual(emptyDump);
    });

    it('filas sin programa (estado corrupto) → lanza sin escribir', async () => {
      const db = openDb();
      const stray = must(valid().exercises[0]);
      await db.table('exercises').add(stray);

      await expect(createPlan({ db, clock: wednesday }).ensureSeeded(valid())).rejects.toThrow(
        /RN-PLN-14/,
      );
      expect(await dump(db)).toEqual({ ...emptyDump, exercises: [stray] });
    });
  });

  it('RN-PLN-25: más de un programa → las consultas lanzan', async () => {
    const db = openDb();
    const plan = createPlan({ db, clock: wednesday });
    await plan.ensureSeeded(valid());
    await db
      .table('programs')
      .add({ ...valid().program, id: uuid(11), startDate: '2026-11-16', blockIds: [BLOCK] });

    await expect(plan.getPosition(date('2026-11-18'))).rejects.toThrow(/RN-PLN-25/);
  });
});
