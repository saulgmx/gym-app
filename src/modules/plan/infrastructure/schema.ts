// Tables owned by the plan module (docs/modules/plan.md §2). app/db.ts composes them into
// db.version(n).stores({...}); no other module reads or writes them (P-4).
export const planStores: Record<'exercises' | 'programs' | 'blocks' | 'templates', string> = {
  exercises: 'id, name, muscleGroup, lumbarRisk',
  programs: 'id',
  blocks: 'id, programId',
  templates: 'id, blockId',
};
