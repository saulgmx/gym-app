// Public API of the `plan` module (docs/modules/plan.md). The only file other modules may import.
// Operations arrive with their tasks in phase 1 (specs/001-fase-1/tasks.md).

import type { Dexie } from 'dexie';
import type { Clock, DataPort } from '@/shared/kernel';
import { createPlanService, type PlanApi as PlanServiceApi } from './application/service';
import type { PlanSnapshot } from './domain/schedule';
import { createPlanDataPort } from './infrastructure/data-port';
import { createDexiePlanRepository } from './infrastructure/dexie-repository';
import { parseSeed } from './infrastructure/seed-schema';

// The service plus the backup port (RN-PLN-29, spec 007), which lives in infrastructure.
export interface PlanApi extends PlanServiceApi {
  dataPort: DataPort<PlanSnapshot>;
}

// Wires the application service to Dexie and the Zod seed parser (architecture §5.3).
export function createPlan(deps: { db: Dexie; clock: Clock }): PlanApi {
  const service = createPlanService({
    repository: createDexiePlanRepository(deps.db),
    parser: parseSeed,
    clock: deps.clock,
  });
  return { ...service, dataPort: createPlanDataPort(deps.db) };
}

export {
  EXERCISE_CHANGE_SECONDS,
  SET_WORK_SECONDS,
  WARMUP_SECONDS,
  displayMinutes,
  plannedSessionSeconds,
  setSeconds,
} from './domain/duration';
export { blockOfWeek } from './domain/schedule';
export { formatRir } from './ui/format';
export { planStores } from './infrastructure/schema';
export { useBlocks, useTodayPlan, useWeekPlan } from './ui/hooks';
export { PlanExerciseList } from './ui/PlanExerciseList';
export { WeekStrip } from './ui/WeekStrip';

export type {
  Block,
  Equipment,
  Exercise,
  LumbarRisk,
  MuscleGroup,
  PlanErrorCode,
  PlannedItem,
  ProgramPosition,
  SessionTemplate,
  TemplateItem,
  TodayPlan,
} from './domain/types';
