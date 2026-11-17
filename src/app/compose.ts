import type { Dexie } from 'dexie';
import { createData } from '@/modules/data';
import { createHealth } from '@/modules/health';
import { createPlan } from '@/modules/plan';
import { createProgression } from '@/modules/progression';
import { createTraining } from '@/modules/training';
import type { Clock } from '@/shared/kernel';

// Composition root (architecture §5.3): instantiates modules and wires ports, DataPorts and
// subscriptions. The bootstrap calls it again in T12, with openDatabase() and `ready`.
export function compose(deps: { db: Dexie; clock: Clock }) {
  return {
    plan: createPlan(deps),
    training: createTraining(),
    progression: createProgression(),
    health: createHealth(),
    data: createData(),
  };
}

export type App = ReturnType<typeof compose>;
