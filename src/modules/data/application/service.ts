import type { Dexie } from 'dexie';
import {
  err,
  ok,
  type Clock,
  type DataDescription,
  type DataPort,
  type LocalFacts,
  type Result,
} from '@/shared/kernel';
import { SCHEMA_VERSION, checkModules, checkVersions } from '../domain/envelope';
import { buildPreview } from '../domain/preview';
import { missingReference } from '../domain/references';
import type { DataError, Envelope, ImportPreview, InvalidModuleDataDetails } from '../domain/types';

// Step 2's shape check lives in infrastructure (Zod, ADR-0012); index wires it, as plan's SeedParser.
export type EnvelopeParser = (text: string) => Result<Envelope, DataError>;

// data's service (docs/modules/data.md §5, §6 "Detalle del servicio", contract v1.4). It never
// knows the modules: everything goes through the DataPorts that compose registers.

export interface PendingImport {
  preview: ImportPreview;
  commit: () => Promise<Result<void, DataError>>; // a property, so the UI can pass it around
}

export interface DataApi {
  registerDataPort<T>(port: DataPort<T>): void;
  exportAll(): Promise<{ filename: string; blob: Blob }>;
  previewImport(file: Blob): Promise<Result<PendingImport, DataError>>;
}

/** RN-DAT-02: 10 MB exactly passes; one byte more does not. */
const MAX_BYTES = 10 * 1024 * 1024;

const workoutInProgress = (): Result<never, DataError> =>
  err({
    code: 'data/workout-in-progress',
    message: 'A workout is in progress on this device (RN-DAT-05)',
  });

function invalidModule(details: InvalidModuleDataDetails): Result<never, DataError> {
  return err({
    code: 'data/invalid-module-data',
    message: `Module ${details.module ?? '(envelope)'} rejected: ${details.cause} (RN-DAT-02)`,
    details,
  });
}

export function createDataService({
  db,
  clock,
  parseEnvelope,
}: {
  db: Dexie;
  clock: Clock;
  parseEnvelope: EnvelopeParser;
}): DataApi {
  const ports: DataPort[] = [];

  // RN-DAT-04: always by `order`, whatever the registration order. No ports is a composition bug.
  function registered(): DataPort[] {
    if (ports.length === 0) throw new Error('No DataPort registered (data.md §6)');
    return [...ports].sort((a, b) => a.order - b.order);
  }

  const tablesOf = (list: DataPort[]) => [...new Set(list.flatMap((p) => p.tables))];
  const isActive = (facts: LocalFacts[]) => facts.some((f) => f.hasActiveWorkout === true);
  const localFacts = (list: DataPort[]) => Promise.all(list.map((p) => p.current()));

  return {
    registerDataPort(port) {
      if (ports.some((p) => p.name === port.name)) {
        throw new Error(`DataPort ${port.name} is already registered (RN-DAT-04)`);
      }
      if (ports.some((p) => p.order === port.order)) {
        throw new Error(`Another DataPort already has order ${String(port.order)} (RN-DAT-04)`);
      }
      ports.push(port);
    },

    // RN-DAT-01, 09: one read transaction over every port's tables, so the file is consistent.
    async exportAll() {
      const list = registered();
      const exportedAt = clock.now();
      const parts = await db.transaction('r', tablesOf(list), () =>
        Promise.all(list.map((p) => p.exportData())),
      );
      const modules = Object.fromEntries(
        list.map((p, i) => [p.name, { version: p.version, data: parts[i] }]),
      );
      const envelope = { app: 'gym-app', schemaVersion: SCHEMA_VERSION, exportedAt, modules };
      return {
        filename: `gym-respaldo-${clock.today()}.json`,
        blob: new Blob([`${JSON.stringify(envelope, null, 2)}\n`], { type: 'application/json' }),
      };
    },

    // RN-DAT-02: the seven steps in order; the first failure wins and nothing is written.
    async previewImport(file) {
      const list = registered();

      if (file.size > MAX_BYTES) {
        return err({
          code: 'data/file-too-large',
          message: `File has ${String(file.size)} bytes, more than ${String(MAX_BYTES)} (RN-DAT-02)`,
        });
      }

      const envelope = parseEnvelope(await file.text());
      if (!envelope.ok) return envelope;
      const infos = list.map((p) => ({ name: p.name, version: p.version }));
      const versions = checkVersions(envelope.value, infos);
      if (!versions.ok) return versions;
      const modules = checkModules(envelope.value, infos);
      if (!modules.ok) return modules;

      const validated: unknown[] = [];
      for (const port of list) {
        const part = envelope.value.modules[port.name];
        if (!part) throw new Error(`Module ${port.name} missing after checkModules`);
        const result = port.validate(part.data, part.version);
        if (!result.ok) {
          return invalidModule({
            module: port.name,
            cause: result.error.code,
            details: result.error.details,
          });
        }
        validated.push(result.value);
      }

      const described: { name: string; description: DataDescription }[] = list.map((p, i) => ({
        name: p.name,
        description: p.describe(validated[i]),
      }));
      const missing = missingReference(described);
      if (missing) {
        return invalidModule({
          module: missing.module,
          cause: 'data/missing-reference',
          details: { kind: missing.kind, id: missing.id },
        });
      }

      const local = await localFacts(list);
      if (isActive(local)) return workoutInProgress();

      const preview = buildPreview(
        envelope.value,
        described.map((d) => d.description.facts),
        local,
      );

      // RN-DAT-03, 05, 10: once, in one rw transaction; RN-DAT-05 is checked again inside it.
      let used = false;
      const commit = async (): Promise<Result<void, DataError>> => {
        if (used) throw new Error('A PendingImport can be committed only once (data.md §6)');
        used = true;
        return db.transaction('rw', tablesOf(list), async () => {
          if (isActive(await localFacts(list))) return workoutInProgress();
          for (const [i, port] of list.entries()) await port.importData(validated[i]);
          return ok(undefined);
        });
      };

      return ok({ preview, commit });
    },
  };
}
