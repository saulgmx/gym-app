import type { Dexie } from 'dexie';
import { createData } from '@/modules/data';
import { createHealth } from '@/modules/health';
import { createPlan } from '@/modules/plan';
import { createProgression } from '@/modules/progression';
import { createTraining, type SuggestionProvider } from '@/modules/training';
import { createUuidV7Generator, type Clock } from '@/shared/kernel';

// No suggestions until progression arrives (phase 4); training then prefills nothing (plan §6.10).
const nullSuggestions: SuggestionProvider = { getPrefill: () => Promise.resolve(null) };

// Composition root (architecture §5.3): instantiates modules and wires ports, DataPorts and
// subscriptions. `ready` settles when the plan seed is loaded (spec 001 plan §5).
export function compose({ db, clock, seed }: { db: Dexie; clock: Clock; seed: unknown }) {
  const plan = createPlan({ db, clock });

  // Rejects with the DomainError in `cause`, or with the storage error as is (ADR-0010).
  const ready = plan.ensureSeeded(seed).then((result) => {
    if (!result.ok) {
      throw new Error(`Plan seed rejected: ${result.error.code}`, { cause: result.error });
    }
  });
  // Marked handled: the error shows once, through use(ready) and ErrorFallback (T17), not also
  // as a notice from the global unhandledrejection handler.
  ready.catch(() => undefined);

  // One generator for every module, so IDs stay monotonic per device (ADR-0009).
  const ids = createUuidV7Generator();
  // health before training: training will take health.painGate (spec 005 T12, RN-TRN-06).
  const health = createHealth({ db, clock, ids });

  return {
    ready,
    plan,
    training: createTraining({
      db,
      clock,
      ids,
      plan,
      suggestions: nullSuggestions,
    }),
    progression: createProgression(),
    health,
    data: createData(),
  };
}

export type App = ReturnType<typeof compose>;
