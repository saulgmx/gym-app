import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ID, LocalDate } from '@/shared/kernel';
import type { AppServices } from '../context';
import { closeTestDatabases, lastTestDatabase } from './test-app';
import { dump } from './test-backup';
import { setup } from './test-sessions';

// Spec 008 T10 (AC-10 to AC-16, AC-24, AC-26): the series CSV with the real modules that compose
// wires (training's port, plan's real seed, data's file), over IndexedDB in memory. The data of
// spec 008 §4 is written through the API, with a clock the test moves: the k-th set marked in a
// session is done at 18:00 + 3k min, so the 2nd set of Prensa on L16 is at 18:06 (AC-12).

const date = (s: string) => s as LocalDate;

afterEach(closeTestDatabases);

type Env = Awaited<ReturnType<typeof setup>>;
interface Values {
  weightKg?: number | null;
  reps?: number | null;
  rir?: number | null;
}

/** Logs and marks a set at `at` (HH:MM of the session's day). */
async function doSet({ services, time }: Env, day: string, setId: ID, at: string, v: Values) {
  const logged = await services.training.logSet(setId, v);
  if (!logged.ok) throw new Error(logged.error.code);
  time.set(`${day}T${at}:00-06:00`);
  const marked = await services.training.toggleSetDone(setId);
  if (!marked.ok) throw new Error(marked.error.code);
}

const hhmm = (minutes: number) => {
  const h = 18 + Math.floor(minutes / 60);
  return `${String(h)}:${String(minutes % 60).padStart(2, '0')}`;
};

/**
 * Starts a session on `day` at 18:00 and marks its first `count` planned sets in session order
 * (all by default), the k-th at 18:00 + 3k min. `values` gives each set's values by exercise name
 * and set number; the default is 40 kg × 10, RIR 3, or 12 reps, RIR 1 for a `reps` exercise.
 */
async function session(
  env: Env,
  day: string,
  opts: {
    plannedFor?: string;
    choose?: [string, string]; // [from, to] exercise names (RN-TRN-13)
    count?: number;
    values?: (name: string, setNumber: number) => Values | undefined;
  } = {},
) {
  env.time.set(`${day}T18:00:00-06:00`);
  const started = await env.services.training.startWorkout(date(day), {
    plannedFor: date(opts.plannedFor ?? day),
  });
  if (!started.ok) throw new Error(started.error.code);
  const workout = started.value;
  if (opts.choose) {
    const view = await viewOf(env.services, workout.id);
    const [from, to] = opts.choose;
    const chosen = await env.services.training.chooseExercise(
      workout.id,
      idByName(view, from),
      idByName(view, to),
    );
    if (!chosen.ok) throw new Error(chosen.error.code);
  }
  const view = await viewOf(env.services, workout.id);
  const sets = view.sets.slice(0, opts.count ?? view.sets.length);
  for (const [i, set] of sets.entries()) {
    const exercise = view.exercises[set.exerciseId];
    if (!exercise) throw new Error('exercise missing from the view');
    const fallback: Values =
      exercise.metric === 'weight' ? { weightKg: 40, reps: 10, rir: 3 } : { reps: 12, rir: 1 };
    const v = opts.values?.(exercise.name, set.setNumber) ?? fallback;
    await doSet(env, day, set.id, hhmm(3 * (i + 1)), v);
  }
  return { workout, view };
}

async function close(env: Env, workoutId: ID, day: string) {
  env.time.set(`${day}T19:10:00-06:00`);
  const pain = await env.services.health.recordPain(workoutId, {
    level: 1,
    redFlags: [],
    date: date(day),
  });
  if (!pain.ok) throw new Error(pain.error.code);
  const finished = await env.services.training.finishWorkout(workoutId, {});
  if (!finished.ok) throw new Error(finished.error.code);
}

async function viewOf(services: AppServices, workoutId: ID) {
  const view = await services.training.getWorkoutView(workoutId);
  if (!view) throw new Error('no view');
  return view;
}

function idByName(view: Awaited<ReturnType<typeof viewOf>>, name: string): ID {
  const found = Object.values(view.exercises).find((e) => e.name === name);
  if (!found) throw new Error(`no exercise ${name}`);
  return found.id;
}

/** Spec 008 §4: L16, M17 (discarded), M18 (5 of 10, planned for the Friday) and L23 (+1 extra). */
async function deviceWithSpecData() {
  const env = await setup();

  // L16, Full body A, week 1: all 10, with Jalón al pecho instead of Dominadas (AC-12, 13, 16).
  const l16 = await session(env, '2026-11-16', {
    choose: ['Dominadas', 'Jalón al pecho'],
    values: (name, n) =>
      name === 'Prensa de piernas' && n === 2 ? { weightKg: 100, reps: 9, rir: 2 } : undefined,
  });
  await close(env, l16.workout.id, '2026-11-16');

  // M17: two done sets, then discarded (AC-10). Tuesday is cardio: another session of the week.
  const m17 = await session(env, '2026-11-17', { plannedFor: '2026-11-18', count: 2 });
  const discarded = await env.services.training.discardWorkout(m17.workout.id);
  if (!discarded.ok) throw new Error(discarded.error.code);

  // M18, Full body A of the Friday done on Wednesday: 5 of 10, one assisted Dominadas (AC-14).
  const m18 = await session(env, '2026-11-18', {
    plannedFor: '2026-11-20',
    count: 5,
    values: (name) => (name === 'Dominadas' ? { weightKg: -20, reps: 8, rir: 2 } : undefined),
  });
  await close(env, m18.workout.id, '2026-11-18');

  // L23, Full body B, week 2: the 19 planned and a 3rd of Fondos as an extra at 19:00 (AC-15).
  const l23 = await session(env, '2026-11-23');
  const extra = await env.services.training.addExtraSet(
    l23.workout.id,
    idByName(l23.view, 'Fondos en paralelas'),
  );
  if (!extra.ok) throw new Error(extra.error.code);
  await doSet(env, '2026-11-23', extra.value.id, '19:00', { weightKg: 0, reps: 8, rir: 1 });
  await close(env, l23.workout.id, '2026-11-23');

  // X25, in progress tonight with one done set (AC-24): it stays out and stays in progress.
  const active = await session(env, '2026-11-25', { count: 1 });

  // Today is Wednesday 2026-11-25 at 21:00 (spec 008 §4).
  env.time.set('2026-11-25T21:00:00-06:00');
  return { ...env, db: lastTestDatabase(), activeId: active.workout.id };
}

async function exportCsv(services: AppServices) {
  const { filename, blob } = await services.data.exportSeriesCsv();
  // ignoreBOM keeps the BOM in the text, so the test sees it.
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob.arrayBuffer());
  return { filename, type: blob.type, text };
}

// The expected file, line by line (RN-DAT-14, RN-TRN-31). Changing these lines means the CSV
// format changed: bump CSV_VERSION in data/domain/csv.ts (ADR-0013).
const HEADER = 'date,week,session,exercise,metric,setNumber,weightKg,reps,rir,isExtra,completedAt';
const L16 = [
  '2026-11-16,1,Full body A,Prensa de piernas,weight,1,40,10,3,false,2026-11-16T18:03:00-06:00',
  '2026-11-16,1,Full body A,Prensa de piernas,weight,2,100,9,2,false,2026-11-16T18:06:00-06:00',
  '2026-11-16,1,Full body A,Press de banca con barra,weight,1,40,10,3,false,2026-11-16T18:09:00-06:00',
  '2026-11-16,1,Full body A,Press de banca con barra,weight,2,40,10,3,false,2026-11-16T18:12:00-06:00',
  '2026-11-16,1,Full body A,Jalón al pecho,weight,1,40,10,3,false,2026-11-16T18:15:00-06:00',
  '2026-11-16,1,Full body A,Jalón al pecho,weight,2,40,10,3,false,2026-11-16T18:18:00-06:00',
  '2026-11-16,1,Full body A,Curl femoral,weight,1,40,10,3,false,2026-11-16T18:21:00-06:00',
  '2026-11-16,1,Full body A,Elevaciones laterales,weight,1,40,10,3,false,2026-11-16T18:24:00-06:00',
  '2026-11-16,1,Full body A,Curl con barra Z,weight,1,40,10,3,false,2026-11-16T18:27:00-06:00',
  '2026-11-16,1,Full body A,Dead bug,reps,1,,12,1,false,2026-11-16T18:30:00-06:00',
];
const M18 = [
  '2026-11-18,1,Full body A,Prensa de piernas,weight,1,40,10,3,false,2026-11-18T18:03:00-06:00',
  '2026-11-18,1,Full body A,Prensa de piernas,weight,2,40,10,3,false,2026-11-18T18:06:00-06:00',
  '2026-11-18,1,Full body A,Press de banca con barra,weight,1,40,10,3,false,2026-11-18T18:09:00-06:00',
  '2026-11-18,1,Full body A,Press de banca con barra,weight,2,40,10,3,false,2026-11-18T18:12:00-06:00',
  '2026-11-18,1,Full body A,Dominadas,weight,1,-20,8,2,false,2026-11-18T18:15:00-06:00',
];
const L23 = [
  '2026-11-23,2,Full body B,Hack squat,weight,1,40,10,3,false,2026-11-23T18:03:00-06:00',
  '2026-11-23,2,Full body B,Hack squat,weight,2,40,10,3,false,2026-11-23T18:06:00-06:00',
  '2026-11-23,2,Full body B,Hack squat,weight,3,40,10,3,false,2026-11-23T18:09:00-06:00',
  '2026-11-23,2,Full body B,Press inclinado con mancuernas,weight,1,40,10,3,false,2026-11-23T18:12:00-06:00',
  '2026-11-23,2,Full body B,Press inclinado con mancuernas,weight,2,40,10,3,false,2026-11-23T18:15:00-06:00',
  '2026-11-23,2,Full body B,Press inclinado con mancuernas,weight,3,40,10,3,false,2026-11-23T18:18:00-06:00',
  '2026-11-23,2,Full body B,Remo con apoyo de pecho,weight,1,40,10,3,false,2026-11-23T18:21:00-06:00',
  '2026-11-23,2,Full body B,Remo con apoyo de pecho,weight,2,40,10,3,false,2026-11-23T18:24:00-06:00',
  '2026-11-23,2,Full body B,Remo con apoyo de pecho,weight,3,40,10,3,false,2026-11-23T18:27:00-06:00',
  '2026-11-23,2,Full body B,Patada de glúteo en polea,weight,1,40,10,3,false,2026-11-23T18:30:00-06:00',
  '2026-11-23,2,Full body B,Patada de glúteo en polea,weight,2,40,10,3,false,2026-11-23T18:33:00-06:00',
  '2026-11-23,2,Full body B,Patada de glúteo en polea,weight,3,40,10,3,false,2026-11-23T18:36:00-06:00',
  '2026-11-23,2,Full body B,Press de hombro con mancuernas,weight,1,40,10,3,false,2026-11-23T18:39:00-06:00',
  '2026-11-23,2,Full body B,Press de hombro con mancuernas,weight,2,40,10,3,false,2026-11-23T18:42:00-06:00',
  '2026-11-23,2,Full body B,Fondos en paralelas,weight,1,40,10,3,false,2026-11-23T18:45:00-06:00',
  '2026-11-23,2,Full body B,Fondos en paralelas,weight,2,40,10,3,false,2026-11-23T18:48:00-06:00',
  '2026-11-23,2,Full body B,Fondos en paralelas,weight,3,0,8,1,true,2026-11-23T19:00:00-06:00',
  '2026-11-23,2,Full body B,Elevación de talones,weight,1,40,10,3,false,2026-11-23T18:51:00-06:00',
  '2026-11-23,2,Full body B,Elevación de talones,weight,2,40,10,3,false,2026-11-23T18:54:00-06:00',
  '2026-11-23,2,Full body B,Elevación de talones,weight,3,40,10,3,false,2026-11-23T18:57:00-06:00',
];

describe('spec 008 T10: el CSV de series con los módulos reales', () => {
  it('AC-10 a AC-16: los datos de la spec §4 dan el archivo esperado, línea a línea', async () => {
    const { services } = await deviceWithSpecData();
    const { filename, type, text } = await exportCsv(services);

    expect(filename).toBe('gym-series-v1-2026-11-25.csv');
    expect(type).toBe('text/csv');
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.slice(1, -2).split('\r\n')).toEqual([HEADER, ...L16, ...M18, ...L23]);
  });

  it('AC-23: una base recién sembrada da el BOM y solo los encabezados', async () => {
    const { services } = await setup();
    const { text } = await exportCsv(services);
    expect(text).toBe(`\uFEFF${HEADER}\r\n`);
  });

  it('AC-24, AC-26: exportar no cambia ninguna tabla y la sesión en curso sigue en curso', async () => {
    const { services, db, activeId } = await deviceWithSpecData();
    const before = await dump(db);

    await exportCsv(services);

    expect(await dump(db)).toStrictEqual(before);
    expect((await services.training.getActiveWorkout())?.id).toBe(activeId);
  });
});
