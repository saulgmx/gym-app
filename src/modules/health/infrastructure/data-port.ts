import type { Dexie } from 'dexie';
import { err, ok, type DataPort, type ID } from '@/shared/kernel';
import { checkHealthBackup, describeHealthBackup } from '../domain/backup';
import type { HealthBackup, PainEntry } from '../domain/types';
import { healthBackupSchema } from './backup-schema';

// Health backup port (RN-HLT-21, contract v1.14 decision 16). Rows travel as stored.

const VERSION = 1;

export function createHealthDataPort(db: Dexie): DataPort<HealthBackup> {
  const painEntries = db.table<PainEntry, ID>('painEntries');

  return {
    name: 'health',
    version: VERSION,
    order: 30,
    tables: [painEntries.name],

    // (e) toArray reads by primary key: by id; its own read transaction, nested in data's.
    exportData: () =>
      db.transaction('r', painEntries, async () => ({ painEntries: await painEntries.toArray() })),

    // (e) only version 1 exists. Shape first, then the module's rules.
    validate(raw, fromVersion) {
      if (fromVersion !== VERSION) {
        throw new Error(
          `Health backup version ${String(fromVersion)} has no migration (RN-HLT-21)`,
        );
      }
      const parsed = healthBackupSchema.safeParse(raw);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => ({
          path: i.path.map(String).join('.'),
          code: i.code,
        }));
        return err({
          code: 'health/invalid-backup',
          message: `Health backup does not match the schema (${String(issues.length)} issues, RN-HLT-21)`,
          details: { rule: 'schema', issues },
        });
      }
      const rules = checkHealthBackup(parsed.data);
      return rules.ok ? ok(parsed.data) : rules;
    },

    describe: describeHealthBackup,

    current: () => Promise.resolve({}),

    importData: (data) =>
      db.transaction('rw', painEntries, async () => {
        await painEntries.clear();
        await painEntries.bulkAdd(data.painEntries);
      }),
  };
}
