import type { Dexie } from 'dexie';
import { err, ok, type DataPort, type ID, type SeriesRow } from '@/shared/kernel';
import { checkTrainingBackup, describeTrainingBackup } from '../domain/backup';
import type { SetLog, TrainingBackup, Workout } from '../domain/types';
import { trainingBackupSchema } from './backup-schema';

// Training backup port (RN-TRN-30, contract v1.31 decision 33). Rows travel as stored.
// seriesRows (RN-TRN-31, spec 008) comes from the application layer, which reads plan.

const VERSION = 1;

export function createTrainingDataPort(
  db: Dexie,
  seriesRows: () => Promise<SeriesRow[]>,
): DataPort<TrainingBackup> {
  const workouts = db.table<Workout, ID>('workouts');
  const sets = db.table<SetLog, ID>('sets');
  const tables = [workouts, sets];

  return {
    name: 'training',
    version: VERSION,
    order: 20,
    tables: tables.map((t) => t.name),

    // (d) toArray reads by primary key: by id. (g) its own read transaction, nested in data's.
    exportData: () =>
      db.transaction('r', tables, async () => {
        const [allWorkouts, allSets] = await Promise.all([workouts.toArray(), sets.toArray()]);
        return { workouts: allWorkouts, sets: allSets };
      }),

    // (g) only version 1 exists. (a) shape first, then the module's rules.
    validate(raw, fromVersion) {
      if (fromVersion !== VERSION) {
        throw new Error(
          `Training backup version ${String(fromVersion)} has no migration (RN-TRN-30)`,
        );
      }
      const parsed = trainingBackupSchema.safeParse(raw);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => ({
          path: i.path.map(String).join('.'),
          code: i.code,
        }));
        return err({
          code: 'training/invalid-backup',
          message: `Training backup does not match the schema (${String(issues.length)} issues, RN-TRN-30)`,
          details: { rule: 'schema', issues },
        });
      }
      const rules = checkTrainingBackup(parsed.data);
      return rules.ok ? ok(parsed.data) : rules;
    },

    describe: describeTrainingBackup,

    // (g) by the status index, inside data's transaction when there is one.
    current: () =>
      db.transaction('r', workouts, async () => {
        const [completed, active] = await Promise.all([
          workouts.where('status').equals('completed').count(),
          workouts.where('status').equals('in_progress').count(),
        ]);
        return { completedWorkouts: completed, hasActiveWorkout: active > 0 };
      }),

    importData: (data) =>
      db.transaction('rw', tables, async () => {
        await Promise.all(tables.map((t) => t.clear()));
        await workouts.bulkAdd(data.workouts);
        await sets.bulkAdd(data.sets);
      }),

    seriesRows,
  };
}
