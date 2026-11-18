import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { displayMinutes } from '@/modules/plan';
import { workoutProgress, type TrainingApi } from '@/modules/training';
import { fixedClock, type ID, type LocalDate } from '@/shared/kernel';
import { closeTestDatabases, createTestServices } from './test-app';

// workoutProgress with the real plan, seed and setSeconds (spec 003 AC-16, AC-21; RN-TRN-20).
// Full body A of week 1, started on Monday 2026-11-16. Expected values computed with Node from
// plan-seed.json: 2280 s with nothing done; 1605 s with Prensa (2 sets) and the 1st set of
// Press de banca done.

const MONDAY = fixedClock('2026-11-16T18:00:00-06:00');

afterEach(closeTestDatabases);

async function startMonday() {
  const services = createTestServices({ clock: MONDAY, seedClock: MONDAY });
  await services.ready;
  const started = await services.training.startWorkout('2026-11-16' as LocalDate);
  if (!started.ok) throw new Error(started.error.code);
  return { training: services.training, workoutId: started.value.id };
}

async function viewOf(training: TrainingApi, workoutId: ID) {
  const view = await training.getWorkoutView(workoutId);
  if (!view) throw new Error('No view');
  return view;
}

async function markDone(training: TrainingApi, workoutId: ID, exerciseIndex: number, n: number) {
  const view = await viewOf(training, workoutId);
  const exerciseId = view.workout.items[exerciseIndex]?.exerciseId;
  const set = view.sets.find((s) => s.exerciseId === exerciseId && s.setNumber === n);
  if (!set) throw new Error(`No set ${String(n)} of item ${String(exerciseIndex + 1)}`);
  await training.logSet(set.id, { weightKg: 60, reps: 10 });
  const result = await training.toggleSetDone(set.id);
  if (!result.ok) throw new Error(result.error.code);
}

describe('workoutProgress con el seed real (RN-TRN-20)', () => {
  it('AC-21: Full body A recién iniciada → 2280 s, "Faltan ~40 min" sin calentamiento', async () => {
    const { training, workoutId } = await startMonday();
    const progress = workoutProgress(await viewOf(training, workoutId));

    expect(progress.remainingSeconds).toBe(2280);
    expect(displayMinutes(progress.remainingSeconds ?? 0)).toBe(40);
    expect(progress.current).toMatchObject({ itemIndex: 1, setNumber: 1 });
  });

  it('AC-16: con Prensa completa y la 1.ª de Press de banca hecha → 1605 s, "Faltan ~25 min"', async () => {
    const { training, workoutId } = await startMonday();
    await markDone(training, workoutId, 0, 1);
    await markDone(training, workoutId, 0, 2);
    await markDone(training, workoutId, 1, 1);

    const progress = workoutProgress(await viewOf(training, workoutId));

    expect(progress.remainingSeconds).toBe(1605);
    expect(displayMinutes(progress.remainingSeconds ?? 0)).toBe(25);
    expect(progress).toMatchObject({
      itemsDone: 1,
      itemCount: 7,
      current: { itemIndex: 2, setNumber: 2 },
      setsDone: 3,
      itemsWithDoneSets: 2,
    });
  });
});
