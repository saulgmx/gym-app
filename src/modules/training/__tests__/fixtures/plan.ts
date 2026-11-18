import type { ID, LocalDate } from '@/shared/kernel';
import type { Exercise, PlanReader, TodayPlan } from '../../application/ports';

// Fake plan for integration and hook tests: every day is a workout day with Prensa (2 of 3 sets)
// and Dominadas or Jalón (1 of 2). Week 1 of a program that starts Monday 2026-11-16.

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
export const prensa = exercise('prensa');
export const dominadas = exercise('dominadas', { muscleGroup: 'back', equipment: 'bodyweight' });
export const jalon = exercise('jalon', { muscleGroup: 'back', equipment: 'cable' });

export const workoutDay: TodayPlan = {
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
    id: id('tpl-a'),
    blockId: id('block-1'),
    name: 'Full body A',
    items: [
      { exerciseId: prensa.id, order: 1, sets: [3, 3], reps: [8, 12] },
      { exerciseId: dominadas.id, alternatives: [jalon.id], order: 2, sets: [2, 2], reps: [6, 10] },
    ],
  },
  plannedItems: [
    {
      exercise: prensa,
      alternatives: [],
      order: 1,
      plannedSets: 2,
      repRange: [8, 12],
      targetRir: [3, 4],
    },
    {
      exercise: dominadas,
      alternatives: [jalon],
      order: 2,
      plannedSets: 1,
      repRange: [6, 10],
      targetRir: [3, 4],
    },
  ],
};

export const plan: PlanReader = {
  getTodayPlan: () => Promise.resolve(workoutDay),
  getExercises: (ids) =>
    Promise.resolve([prensa, dominadas, jalon].filter((e) => ids.includes(e.id))),
};
