import type { Dexie } from 'dexie';
import type { ID } from '@/shared/kernel';
import type { PlanRepository } from '../application/ports';
import type { Block, Exercise, Program, SessionTemplate } from '../domain/types';

// Plan repository over the module's own Dexie tables. Rows are the domain objects as they are
// (RN-PLN-25).
export function createDexiePlanRepository(db: Dexie): PlanRepository {
  const exercises = db.table<Exercise, ID>('exercises');
  const programs = db.table<Program, ID>('programs');
  const blocks = db.table<Block, ID>('blocks');
  const templates = db.table<SessionTemplate, ID>('templates');
  const tables = [exercises, programs, blocks, templates];

  return {
    // One read transaction, so the snapshot is consistent. Only Dexie promises are awaited
    // (plan §6.4).
    loadSnapshot: () =>
      db.transaction('r', tables, async () => {
        const [program, ...others] = await programs.toArray();
        if (!program) return undefined;
        if (others.length > 0) throw new Error('More than one program stored (RN-PLN-25)');
        const [programBlocks, allTemplates, allExercises] = await Promise.all([
          blocks.where('programId').equals(program.id).toArray(),
          templates.toArray(),
          exercises.toArray(),
        ]);
        return { program, blocks: programBlocks, templates: allTemplates, exercises: allExercises };
      }),

    // RN-PLN-14: check and write in the same rw transaction; IndexedDB serializes concurrent
    // ones, also across tabs. bulkAdd never replaces a row: a duplicate key aborts everything.
    seedIfEmpty: (snapshot) =>
      db.transaction('rw', tables, async () => {
        if ((await programs.count()) > 0) return;
        const counts = await Promise.all([exercises.count(), blocks.count(), templates.count()]);
        if (counts.some((n) => n > 0)) {
          throw new Error('Plan tables hold rows without a program (RN-PLN-14)');
        }
        await exercises.bulkAdd(snapshot.exercises);
        await programs.add(snapshot.program);
        await blocks.bulkAdd(snapshot.blocks);
        await templates.bulkAdd(snapshot.templates);
      }),
  };
}
