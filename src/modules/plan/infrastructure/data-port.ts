import type { Dexie } from 'dexie';
import { err, ok, type DataPort, type ID } from '@/shared/kernel';
import type { PlanSnapshot } from '../domain/schedule';
import { validateSeed } from '../domain/seed-rules';
import type { Block, Exercise, Program, SessionTemplate } from '../domain/types';
import { issuesOf, planBackupSchema } from './seed-schema';

// Plan backup port (RN-PLN-29, contract v1.22 decision 25). The format is the seed's with the
// program's start date, so a backup passes exactly the seed's checks, P-1 included.

const VERSION = 1;

export function createPlanDataPort(db: Dexie): DataPort<PlanSnapshot> {
  const exercises = db.table<Exercise, ID>('exercises');
  const programs = db.table<Program, ID>('programs');
  const blocks = db.table<Block, ID>('blocks');
  const templates = db.table<SessionTemplate, ID>('templates');
  const tables = [exercises, programs, blocks, templates];

  return {
    name: 'plan',
    version: VERSION,
    order: 10,
    tables: tables.map((t) => t.name),

    // (a) toArray reads by primary key, so rows come out by id. (b) every block in the table.
    // (f) its own read transaction, nested in data's when there is one.
    exportData: () =>
      db.transaction('r', tables, async () => {
        const [stored, ...others] = await programs.toArray();
        if (!stored) throw new Error('No program to export; await ensureSeeded first (RN-PLN-22)');
        if (others.length > 0) throw new Error('More than one program stored (RN-PLN-25)');
        const [allExercises, allBlocks, allTemplates] = await Promise.all([
          exercises.toArray(),
          blocks.toArray(),
          templates.toArray(),
        ]);
        return {
          exercises: allExercises,
          program: stored,
          blocks: allBlocks,
          templates: allTemplates,
        };
      }),

    // (c) only version 1 exists. (d) schema first, then the seed rules, high risk first.
    validate(raw, fromVersion) {
      if (fromVersion !== VERSION) {
        throw new Error(`Plan backup version ${String(fromVersion)} has no migration (RN-PLN-29)`);
      }
      const parsed = planBackupSchema.safeParse(raw);
      if (!parsed.success) {
        const issues = issuesOf(parsed.error);
        return err({
          code: 'plan/invalid-seed',
          message: `Plan backup does not match the schema (${String(issues.length)} issues, RN-PLN-29)`,
          details: issues,
        });
      }
      const { startDate, ...program } = parsed.data.program;
      const rules = validateSeed({ ...parsed.data, program });
      if (!rules.ok) return rules;
      return ok({ ...parsed.data, program: { ...program, startDate } });
    },

    // (g)
    describe: (data) => ({
      facts: { programStartDate: data.program.startDate },
      provides: { exercise: data.exercises.map((e) => e.id) },
      requires: {},
    }),

    current: () => Promise.resolve({}),

    // (f) clears and writes the 4 tables in one rw transaction, nested in data's.
    importData: (data) =>
      db.transaction('rw', tables, async () => {
        await Promise.all(tables.map((t) => t.clear()));
        await exercises.bulkAdd(data.exercises);
        await programs.add(data.program);
        await blocks.bulkAdd(data.blocks);
        await templates.bulkAdd(data.templates);
      }),
  };
}
