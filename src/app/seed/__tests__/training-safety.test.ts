import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Exercise } from '@/modules/plan';
import type { TrainingApi, WorkoutView } from '@/modules/training';
import { addDays, fixedClock, type ID, type LocalDate } from '@/shared/kernel';
import { compose } from '../../compose';
import { openDatabase } from '../../db';
import planSeed from '../plan-seed.json';

// Spec 002 AC-41 (P-1, QS-01): over the real seed, no workout and no option of any workout can
// be a high-risk exercise. It lives in app because training may not import the seed (plan §7).
// Loaded on Wednesday 2026-11-18, so the 15-week program runs from Monday 2026-11-16.

const START = '2026-11-16' as LocalDate;
const DAYS = 15 * 7;

/** Every exercise a workout can hold: the chosen one of each item and all its options. */
function highRiskIn(view: WorkoutView): ID[] {
  const ids = view.workout.items.flatMap((i) => [i.exerciseId, ...i.options]);
  return ids.filter((id) => view.exercises[id]?.lumbarRisk === 'high');
}

let db: Dexie;
let training: TrainingApi;

beforeAll(async () => {
  db = openDatabase({ name: crypto.randomUUID() });
  const app = compose({ db, clock: fixedClock('2026-11-18T08:00:00-06:00'), seed: planSeed });
  await app.ready;
  training = app.training;
});

afterAll(async () => {
  db.close();
  await Dexie.delete(db.name);
});

async function view(workoutId: ID): Promise<WorkoutView> {
  const found = await training.getWorkoutView(workoutId);
  if (!found) throw new Error(`No view for ${workoutId}`);
  return found;
}

describe('AC-41: ningún ejercicio high en ninguna sesión del seed real', () => {
  it('cada plantilla, con su principal y cada alternativa elegida', async () => {
    const templates = new Set<ID>();
    let alternativesChosen = 0;

    for (let day = 0; day < DAYS; day += 1) {
      const date = addDays(START, day);
      const started = await training.startWorkout(date);
      if (!started.ok) {
        expect(started.error.code, date).toBe('training/no-plan-today');
        continue;
      }
      const workout = started.value;
      if (workout.templateId) templates.add(workout.templateId);

      expect(highRiskIn(await view(workout.id)), date).toEqual([]);
      for (const item of workout.items) {
        for (const option of item.options.slice(1)) {
          const chosen = await training.chooseExercise(workout.id, item.exerciseId, option);
          expect(chosen.ok, `${date} ${option}`).toBe(true);
          expect(highRiskIn(await view(workout.id)), `${date} ${option}`).toEqual([]);
          alternativesChosen += 1;
          await training.chooseExercise(workout.id, option, item.exerciseId);
        }
      }
      expect((await training.discardWorkout(workout.id)).ok).toBe(true);
    }

    // The walk really covered the plan: all 11 templates and the 16 items with an alternative
    // appear many times across the 15 weeks.
    expect(templates.size).toBe(11);
    expect(alternativesChosen).toBeGreaterThan(16);
  });

  it('la comprobación sí detecta un high (no pasa sin probar nada)', () => {
    const deadlift = { id: 'peso-muerto' as ID, lumbarRisk: 'high' } as Exercise;
    const safe = { id: 'prensa' as ID, lumbarRisk: 'low' } as Exercise;
    const fake = {
      workout: { items: [{ exerciseId: safe.id, options: [safe.id, deadlift.id] }] },
      exercises: { [safe.id]: safe, [deadlift.id]: deadlift },
    } as unknown as WorkoutView;

    expect(highRiskIn(fake)).toEqual(['peso-muerto']);
  });
});
