// Tables owned by the training module (docs/modules/training.md §2). app/db.ts composes them into
// db.version(n).stores({...}); no other module reads or writes them (P-4).
export const trainingStores: Record<'workouts' | 'sets', string> = {
  workouts: 'id, date, status, templateId',
  sets: 'id, workoutId, exerciseId, [exerciseId+completedAt]',
};
