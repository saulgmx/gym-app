import { createData } from '@/modules/data';
import { createHealth } from '@/modules/health';
import { createPlan } from '@/modules/plan';
import { createProgression } from '@/modules/progression';
import { createTraining } from '@/modules/training';

// Composition root (architecture §5.3): instantiates modules and wires ports, DataPorts and
// subscriptions. Called from the bootstrap in T17.
export function compose() {
  return {
    plan: createPlan(),
    training: createTraining(),
    progression: createProgression(),
    health: createHealth(),
    data: createData(),
  };
}

export type App = ReturnType<typeof compose>;
