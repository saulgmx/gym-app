import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  sequentialIds,
  type Clock,
  type ID,
  type IdGenerator,
  type Instant,
  type LocalDate,
} from '@/shared/kernel';
import { createHealth, healthStores } from '..';
import type { PainEntry } from '../domain/types';

// RN-HLT-09, 14, 16, 17, 18 (contract v1.6, decision 8): the health service over IndexedDB in
// memory, through the public API. Each test opens its own database, as app/db.ts will.

const id = (s: string) => s as ID;
const date = (s: string) => s as LocalDate;

const opened: Dexie[] = [];

function openDb(name: string = crypto.randomUUID()): Dexie {
  const db = new Dexie(name);
  db.version(1).stores(healthStores);
  opened.push(db);
  return db;
}

afterEach(async () => {
  vi.restoreAllMocks();
  const names = new Set(opened.map((db) => db.name));
  for (const db of opened.splice(0)) db.close();
  await Promise.all([...names].map((name) => Dexie.delete(name)));
});

// A clock the test moves by hand, so each recordPain gets the instant it is given.
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

// An IdGenerator whose calls can be counted.
const countedIds = (prefix = 'pain') => {
  const inner = sequentialIds(prefix);
  return { next: vi.fn(() => inner.next()) } satisfies IdGenerator;
};

function setup(db: Dexie = openDb(), start = '2026-11-16T19:00:00-06:00') {
  const time = movableClock(start);
  const ids = countedIds();
  const health = createHealth({ db, clock: time.clock, ids });
  return { db, health, ids, time };
}

const entries = (db: Dexie) => db.table<PainEntry, ID>('painEntries').toArray();

const okValue = <T>(result: { ok: true; value: T } | { ok: false; error: { code: string } }) => {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}`);
  return result.value;
};

describe('recordPain', () => {
  it('RN-HLT-09: guarda la entrada con recordedAt = ahora y devuelve la evaluación', async () => {
    const { db, health } = setup();

    const result = await health.recordPain(id('w1'), {
      level: 8,
      redFlags: ['numbness'],
      date: date('2026-11-16'),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        status: 'alert',
        message:
          'Dolor alto. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta.',
        redFlagMessage:
          'Consulta a un médico antes de seguir entrenando. No se sugerirá subir carga.',
        blocksProgression: true,
      },
    });
    expect(await entries(db)).toEqual([
      {
        id: 'pain-0001',
        workoutId: 'w1',
        date: '2026-11-16',
        recordedAt: '2026-11-16T19:00:00-06:00',
        level: 8,
        redFlags: ['numbness'],
      },
    ]);
  });

  it('RN-HLT-09: guarda el nivel normalizado (-0 → 0)', async () => {
    const { db, health } = setup();

    okValue(
      await health.recordPain(id('w1'), { level: -0, redFlags: [], date: date('2026-11-16') }),
    );

    const [stored] = await entries(db);
    expect(Object.is(stored?.level, 0)).toBe(true);
  });

  it('RN-HLT-09: un nivel inválido devuelve el error sin tocar la base ni gastar un ID', async () => {
    const { db, health, ids } = setup();
    // A closed database rejects any access (DatabaseClosedError): the call must not reach it.
    db.close();

    const result = await health.recordPain(id('w1'), {
      level: 11,
      redFlags: [],
      date: date('2026-11-16'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('health/pain-out-of-range');
    expect(result.error.message).toMatch(/RN-HLT-01/);
    expect(ids.next).not.toHaveBeenCalled();
  });

  it('RN-HLT-09: una bandera inválida devuelve el error sin tocar la base ni gastar un ID', async () => {
    const { db, health, ids } = setup();
    db.close();

    const result = await health.recordPain(id('w1'), {
      level: 2,
      redFlags: ['numbness', 'numbness'],
      date: date('2026-11-16'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('health/invalid-red-flag');
    expect(result.error.message).toMatch(/RN-HLT-15/);
    expect(ids.next).not.toHaveBeenCalled();
  });

  it('RN-HLT-09: con la base abierta, una entrada inválida no escribe nada', async () => {
    const { db, health } = setup();

    await health.recordPain(id('w1'), { level: 2.5, redFlags: [], date: date('2026-11-16') });

    expect(await entries(db)).toEqual([]);
  });

  it('RN-HLT-09: registrar otra vez el mismo workout reemplaza todo salvo el id, sin gastar IDs', async () => {
    const { db, health, ids, time } = setup();
    okValue(
      await health.recordPain(id('w1'), {
        level: 4,
        redFlags: ['numbness'],
        date: date('2026-11-16'),
      }),
    );
    time.set('2026-11-17T00:10:00-06:00');

    const again = await health.recordPain(id('w1'), {
      level: 2,
      redFlags: [],
      date: date('2026-11-17'),
    });

    expect(again.ok).toBe(true);
    expect(await entries(db)).toEqual([
      {
        id: 'pain-0001',
        workoutId: 'w1',
        date: '2026-11-17',
        recordedAt: '2026-11-17T00:10:00-06:00',
        level: 2,
        redFlags: [],
      },
    ]);
    expect(ids.next).toHaveBeenCalledTimes(1);
  });

  it('RN-HLT-09: workouts distintos tienen entradas distintas', async () => {
    const { db, health } = setup();
    okValue(
      await health.recordPain(id('w1'), { level: 1, redFlags: [], date: date('2026-11-16') }),
    );
    okValue(
      await health.recordPain(id('w2'), { level: 2, redFlags: [], date: date('2026-11-18') }),
    );

    const stored = await entries(db);
    expect(stored.map((e) => [e.id, e.workoutId, e.level])).toEqual([
      ['pain-0001', 'w1', 1],
      ['pain-0002', 'w2', 2],
    ]);
  });

  it('RN-HLT-09: dos registros a la vez del mismo workout, desde dos conexiones, dejan una sola entrada', async () => {
    const name = crypto.randomUUID();
    const a = setup(openDb(name));
    const b = setup(openDb(name));

    const results = await Promise.all([
      a.health.recordPain(id('w1'), { level: 3, redFlags: [], date: date('2026-11-16') }),
      b.health.recordPain(id('w1'), { level: 5, redFlags: [], date: date('2026-11-16') }),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    const stored = await entries(a.db);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.workoutId).toBe('w1');
  });
});

describe('hasPainEntry y painGate', () => {
  it('RN-HLT-18: true tras registrar el dolor del workout, false con otro workout', async () => {
    const { health } = setup();
    expect(await health.hasPainEntry(id('w1'))).toBe(false);

    okValue(
      await health.recordPain(id('w1'), { level: 0, redFlags: [], date: date('2026-11-16') }),
    );

    expect(await health.hasPainEntry(id('w1'))).toBe(true);
    expect(await health.hasPainEntry(id('w-desconocido'))).toBe(false);
  });

  it('RN-HLT-18: painGate.hasPainEntry responde igual que hasPainEntry', async () => {
    const { health } = setup();
    expect(await health.painGate.hasPainEntry(id('w1'))).toBe(false);

    okValue(
      await health.recordPain(id('w1'), { level: 6, redFlags: [], date: date('2026-11-16') }),
    );

    expect(await health.painGate.hasPainEntry(id('w1'))).toBe(true);
    expect(await health.painGate.hasPainEntry(id('w2'))).toBe(false);
  });
});

describe('getPainSummary', () => {
  it('RN-HLT-17: sin entradas devuelve el resumen vacío con umbral 3', async () => {
    const { health } = setup();

    expect(await health.getPainSummary()).toEqual({
      latest: null,
      latestAssessment: null,
      persistentAlert: null,
      notice: null,
      threshold: 3,
    });
  });

  it('RN-HLT-17: arma latest, latestAssessment, persistentAlert y notice con el dominio', async () => {
    const { health, time } = setup();
    okValue(
      await health.recordPain(id('w1'), { level: 1, redFlags: [], date: date('2026-11-16') }),
    );
    time.set('2026-11-18T19:00:00-06:00');
    okValue(
      await health.recordPain(id('w2'), { level: 2, redFlags: [], date: date('2026-11-18') }),
    );
    time.set('2026-11-20T19:00:00-06:00');
    okValue(
      await health.recordPain(id('w3'), { level: 3, redFlags: [], date: date('2026-11-20') }),
    );

    expect(await health.getPainSummary()).toEqual({
      latest: {
        id: 'pain-0003',
        workoutId: 'w3',
        date: '2026-11-20',
        recordedAt: '2026-11-20T19:00:00-06:00',
        level: 3,
        redFlags: [],
      },
      latestAssessment: {
        status: 'normal',
        message: 'Molestia leve, dentro de lo normal. Sigue con el plan.',
        blocksProgression: false,
      },
      persistentAlert: { reason: 'rising_3x' },
      notice: {
        cause: 'rising_3x',
        message:
          'Tu dolor lumbar subió en las 3 últimas sesiones (1 → 2 → 3). Hoy prioriza la técnica y no añadas carga.',
      },
      threshold: 3,
    });
  });

  it('RN-HLT-17: usa el umbral 3 para la alerta persistente', async () => {
    const { health, time } = setup();
    okValue(
      await health.recordPain(id('w1'), { level: 4, redFlags: [], date: date('2026-11-16') }),
    );
    time.set('2026-11-18T19:00:00-06:00');
    okValue(
      await health.recordPain(id('w2'), { level: 4, redFlags: [], date: date('2026-11-18') }),
    );

    const summary = await health.getPainSummary();

    expect(summary.persistentAlert).toEqual({ reason: 'over_threshold_2x' });
    expect(summary.notice?.message).toMatch(/por encima de 3\/10/);
  });

  it('RN-HLT-14: una sesión del lunes cerrada después de la del martes es la última', async () => {
    const { health, time } = setup(openDb(), '2026-11-17T19:00:00-06:00');
    okValue(
      await health.recordPain(id('martes'), { level: 5, redFlags: [], date: date('2026-11-17') }),
    );
    time.set('2026-11-17T21:00:00-06:00');
    okValue(
      await health.recordPain(id('lunes'), { level: 2, redFlags: [], date: date('2026-11-16') }),
    );

    const summary = await health.getPainSummary();

    expect(summary.latest?.workoutId).toBe('lunes');
    expect(summary.notice).toBeNull();
  });

  it('RN-HLT-14: el reemplazo cuenta como el registro más reciente', async () => {
    const { health, time } = setup();
    okValue(
      await health.recordPain(id('w1'), { level: 5, redFlags: [], date: date('2026-11-16') }),
    );
    time.set('2026-11-18T19:00:00-06:00');
    okValue(
      await health.recordPain(id('w2'), { level: 2, redFlags: [], date: date('2026-11-18') }),
    );
    time.set('2026-11-18T20:00:00-06:00');
    okValue(
      await health.recordPain(id('w1'), { level: 6, redFlags: [], date: date('2026-11-16') }),
    );

    expect((await health.getPainSummary()).latest).toMatchObject({ workoutId: 'w1', level: 6 });
  });

  it('RN-HLT-14: con offsets distintos ordena por instante, no por string', async () => {
    // 10:00+01:00 is 09:00Z and comes BEFORE 09:30Z, though it sorts after it as a string.
    const { health, time } = setup(openDb(), '2026-11-17T10:00:00+01:00');
    okValue(
      await health.recordPain(id('madrid'), { level: 5, redFlags: [], date: date('2026-11-17') }),
    );
    time.set('2026-11-17T09:30:00+00:00');
    okValue(
      await health.recordPain(id('londres'), { level: 2, redFlags: [], date: date('2026-11-17') }),
    );

    expect((await health.getPainSummary()).latest?.workoutId).toBe('londres');
  });

  it('RN-HLT-14: con el mismo instante, primero el id mayor', async () => {
    const db = openDb();
    // IDs in the opposite order of creation, so the tie is broken by id and not by insertion.
    const queue = [id('pain-b'), id('pain-a')];
    const ids: IdGenerator = {
      next: () => {
        const next = queue.shift();
        if (!next) throw new Error('no more ids');
        return next;
      },
    };
    const { clock } = movableClock('2026-11-16T19:00:00-06:00');
    const health = createHealth({ db, clock, ids });
    okValue(
      await health.recordPain(id('w1'), { level: 5, redFlags: [], date: date('2026-11-16') }),
    );
    okValue(
      await health.recordPain(id('w2'), { level: 2, redFlags: [], date: date('2026-11-16') }),
    );

    expect((await health.getPainSummary()).latest?.id).toBe('pain-b');
  });
});

describe('fallos del almacenamiento', () => {
  it('RN-HLT-16: si la base falla, recordPain, getPainSummary y hasPainEntry rechazan', async () => {
    const { db, health } = setup();
    db.close();

    const closed = { name: 'DatabaseClosedError' };

    await expect(
      health.recordPain(id('w1'), { level: 2, redFlags: [], date: date('2026-11-16') }),
    ).rejects.toMatchObject(closed);
    await expect(health.getPainSummary()).rejects.toMatchObject(closed);
    await expect(health.hasPainEntry(id('w1'))).rejects.toMatchObject(closed);
    await expect(health.painGate.hasPainEntry(id('w1'))).rejects.toMatchObject(closed);
  });

  it('RN-HLT-16: un fallo a mitad del reemplazo rechaza y deja la entrada anterior intacta', async () => {
    const { db, health, time } = setup();
    okValue(
      await health.recordPain(id('w1'), { level: 4, redFlags: [], date: date('2026-11-16') }),
    );
    const before = await entries(db);
    // Any write fails, whether the replacement updates the row or writes it again.
    const fail = () => {
      throw new Error('disk failure');
    };
    db.table('painEntries').hook('updating', fail);
    db.table('painEntries').hook('creating', fail);
    time.set('2026-11-17T08:00:00-06:00');

    await expect(
      health.recordPain(id('w1'), { level: 7, redFlags: ['weakness'], date: date('2026-11-17') }),
    ).rejects.toThrow(/disk failure/);

    expect(await entries(db)).toEqual(before);
  });
});
