// Public API of the `plan` module (docs/modules/plan.md). The only file other modules may import.
// Operations arrive with their tasks in phase 1 (specs/001-fase-1/tasks.md).

import type { Dexie } from 'dexie';
import type { Clock } from '@/shared/kernel';
import { createPlanService, type PlanApi } from './application/service';
import { createDexiePlanRepository } from './infrastructure/dexie-repository';
import { parseSeed } from './infrastructure/seed-schema';

// Wires the application service to Dexie and the Zod seed parser (architecture §5.3).
export function createPlan(deps: { db: Dexie; clock: Clock }): PlanApi {
  return createPlanService({
    repository: createDexiePlanRepository(deps.db),
    parser: parseSeed,
    clock: deps.clock,
  });
}

export {
  EXERCISE_CHANGE_SECONDS,
  SET_WORK_SECONDS,
  WARMUP_SECONDS,
  displayMinutes,
  plannedSessionSeconds,
  setSeconds,
} from './domain/duration';
export { formatRir } from './ui/format';
export { planStores } from './infrastructure/schema';
export { useTodayPlan, useWeekPlan } from './ui/hooks';
export { PlanExerciseList } from './ui/PlanExerciseList';
export { WeekStrip } from './ui/WeekStrip';

export type { PlanApi } from './application/service';
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
