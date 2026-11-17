// Public API of the `plan` module (docs/modules/plan.md). The only file other modules may import.
// Operations arrive with their tasks in phase 1 (specs/001-fase-1/tasks.md).

export type PlanApi = Record<string, never>;

export function createPlan(): PlanApi {
  return {};
}

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
