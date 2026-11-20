import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { fixedClock, type ID, type LocalDate } from '@/shared/kernel';
import { compose } from '../compose';
import type { AppServices } from '../context';
import { openDatabase } from '../db';
import planSeed from '../seed/plan-seed.json';
import { closeTestDatabases } from './test-app';
import { deviceWithSpecData, dump, exportText, freshDevice } from './test-backup';

// Spec 007 T13 (RN-DAT-08, QS-04, CA-6): the backup with the real ports that compose registers,
// between two databases in memory, with the spec §4 data written through the API and the real
// seed (36 exercises). data cannot import modules, so this round trip lives in app.

const date = (s: string) => s as LocalDate;

afterEach(closeTestDatabases);

async function restore(services: AppServices, text: string) {
  const preview = await services.data.previewImport(new File([text], 'gym-respaldo.json'));
  if (!preview.ok) throw new Error(`preview failed: ${preview.error.code}`);
  const committed = await preview.value.commit();
  if (!committed.ok) throw new Error(`commit failed: ${committed.error.code}`);
  return preview.value.preview;
}

// RN-DAT-08 (contract v1.5, decision 5): the same content; key order inside a row may change.
const contentOf = (text: string): unknown => {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  delete parsed.exportedAt;
  return parsed;
};

const sameTextBut = (text: string) => text.replace(/"exportedAt": "[^"]+"/, '"exportedAt": "…"');

describe('spec 007 T13: compose registra los puertos', () => {
  it('el respaldo lleva plan, training y health, en ese orden', async () => {
    const { services } = await freshDevice();
    const parsed = JSON.parse(await exportText(services)) as { modules: object };
    expect(Object.keys(parsed.modules)).toEqual(['plan', 'training', 'health']);
  });

  it('AC-11, AC-8: una base recién sembrada exporta el plan real y nada más', async () => {
    const { services } = await freshDevice('2026-11-18T08:00:00-06:00');
    const { modules } = JSON.parse(await exportText(services)) as {
      modules: {
        plan: { data: { exercises: unknown[]; program: { startDate: string } } };
        training: { data: unknown };
        health: { data: unknown };
      };
    };
    expect(modules.plan.data.exercises).toHaveLength(36);
    expect(modules.plan.data.program.startDate).toBe('2026-11-16');
    expect(modules.training.data).toEqual({ workouts: [], sets: [] });
    expect(modules.health.data).toEqual({ painEntries: [] });
  });
});

describe('spec 007 T13: ida y vuelta (RN-DAT-08, AC-26)', () => {
  it('restaurar en otra base deja las mismas tablas y vuelve a exportar el mismo archivo', async () => {
    const a = await deviceWithSpecData();
    const text = await exportText(a.services);
    const b = await freshDevice();

    await restore(b.services, text);

    expect(await dump(b.db)).toStrictEqual(await dump(a.db));
    expect(contentOf(await exportText(b.services))).toStrictEqual(contentOf(text));
  });

  it('RN-DAT-08 (decisión 5): una segunda ida y vuelta da el mismo texto', async () => {
    const a = await deviceWithSpecData();
    const b = await freshDevice();
    await restore(b.services, await exportText(a.services));
    const once = await exportText(b.services);
    const c = await freshDevice();
    await restore(c.services, once);
    expect(sameTextBut(await exportText(c.services))).toBe(sameTextBut(once));
  });

  it('AC-14: la vista previa cuenta 2 sesiones, 15 series y 2 registros de dolor, del 16 al 18', async () => {
    const a = await deviceWithSpecData();
    const b = await freshDevice();
    expect(await restore(b.services, await exportText(a.services))).toMatchObject({
      completedWorkouts: 2,
      doneSets: 15,
      painEntries: 2,
      dateRange: { from: '2026-11-16', to: '2026-11-18' },
      hasActiveWorkout: false,
      programStartDate: '2026-11-16',
      currentCompletedWorkouts: 0,
    });
  });

  it('AC-22, AC-23, AC-25: tras restaurar, los módulos leen lo del archivo, también la semana del programa', async () => {
    const a = await deviceWithSpecData();
    const b = await freshDevice('2026-12-02T09:00:00-06:00'); // its own program started Nov 30
    await restore(b.services, await exportText(a.services));

    const history = await b.services.training.listWorkoutHistory();
    expect(history.map((h) => h.workout.date)).toEqual(['2026-11-18', '2026-11-16']);
    const pain = await b.services.health.getPainForWorkouts(history.map((h) => h.workout.id));
    expect([...pain.values()].map((p) => p.level).sort()).toEqual([2, 5]);
    const position = await b.services.plan.getPosition(date('2026-11-18'));
    expect(position).toMatchObject({ startDate: '2026-11-16', week: 1 });
  });

  it('AC-24: al volver a abrir la app sobre esa base, el seed no la pisa (RN-PLN-14)', async () => {
    const a = await deviceWithSpecData();
    const b = await freshDevice('2026-12-02T09:00:00-06:00');
    await restore(b.services, await exportText(a.services));
    const before = await dump(b.db);

    const reopened = openDatabase({ name: b.db.name });
    const app = compose({
      db: reopened,
      clock: fixedClock('2026-12-03T09:00:00-06:00'),
      seed: planSeed,
    });
    await app.ready;
    expect(await dump(reopened)).toStrictEqual(before);
    reopened.close();
  });
});

describe('spec 007 T13: referencias entre módulos con los puertos reales', () => {
  it('AC-36: una serie de un ejercicio que no está en el plan → invalid-module-data de training', async () => {
    const a = await deviceWithSpecData();
    const file = JSON.parse(await exportText(a.services)) as {
      modules: { training: { data: { sets: { exerciseId: ID }[] } } };
    };
    const first = file.modules.training.data.sets[0];
    if (!first) throw new Error('fixture');
    first.exerciseId = '0196a000-0000-7000-8000-999999999999' as ID;

    const b = await freshDevice();
    const before = await dump(b.db);
    const result = await b.services.data.previewImport(new File([JSON.stringify(file)], 'x.json'));
    expect(!result.ok && result.error).toMatchObject({
      code: 'data/invalid-module-data',
      details: {
        module: 'training',
        cause: 'data/missing-reference',
        details: { kind: 'exercise', id: '0196a000-0000-7000-8000-999999999999' },
      },
    });
    expect(await dump(b.db)).toStrictEqual(before);
  });
});
