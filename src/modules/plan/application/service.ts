import {
  ok,
  startOfIsoWeek,
  type Clock,
  type ID,
  type LocalDate,
  type Result,
} from '@/shared/kernel';
import { getDayPlan, getPosition, getWeekPlan, type PlanSnapshot } from '../domain/schedule';
import { validateSeed } from '../domain/seed-rules';
import type { Block, Exercise, PlanError, ProgramPosition, TodayPlan } from '../domain/types';
import type { PlanRepository, SeedParser } from './ports';

// Use cases of the plan module (docs/modules/plan.md §4, phase 1 and 2 operations).
// Only repository promises are awaited, so useLiveQuery can track the tables (plan §6.4).

export interface PlanApi {
  ensureSeeded(seed: unknown): Promise<Result<void, PlanError>>;
  getPosition(date: LocalDate): Promise<ProgramPosition>;
  getTodayPlan(date: LocalDate): Promise<TodayPlan>;
  getWeekPlan(weekStart: LocalDate): Promise<TodayPlan[]>;
  getExercise(id: ID): Promise<Exercise | undefined>;
  // One entry per requested ID, in order, skipping missing ones.
  getExercises(ids: ID[]): Promise<Exercise[]>;
  // RN-PLN-28 (spec 006): by startWeek, since the store reads them by programId in no order.
  getBlocks(): Promise<Block[]>;
}

export function createPlanService(deps: {
  repository: PlanRepository;
  parser: SeedParser;
  clock: Clock;
}): PlanApi {
  const { repository, parser, clock } = deps;

  // RN-PLN-22, 23: read on every call; no program means the caller skipped `ready`.
  async function load(): Promise<PlanSnapshot> {
    const snapshot = await repository.loadSnapshot();
    if (!snapshot) throw new Error('No program loaded; await ensureSeeded first (RN-PLN-22)');
    return snapshot;
  }

  return {
    // RN-PLN-20: parser, rules, then write; the first error is returned as is.
    async ensureSeeded(raw) {
      const parsed = parser(raw);
      if (!parsed.ok) return parsed;
      const valid = validateSeed(parsed.value);
      if (!valid.ok) return valid;

      const { program, ...rest } = parsed.value;
      const startDate = startOfIsoWeek(clock.today()); // RN-PLN-13
      await repository.seedIfEmpty({ ...rest, program: { ...program, startDate } });
      return ok(undefined);
    },
    getPosition: async (date) => getPosition(await load(), date),
    getTodayPlan: async (date) => getDayPlan(await load(), date),
    getWeekPlan: async (weekStart) => getWeekPlan(await load(), weekStart),
    getExercise: async (id) => (await load()).exercises.find((e) => e.id === id),
    async getExercises(ids) {
      const byId = new Map((await load()).exercises.map((e) => [e.id, e]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    },
    getBlocks: async () => [...(await load()).blocks].sort((a, b) => a.startWeek - b.startWeek),
  };
}
