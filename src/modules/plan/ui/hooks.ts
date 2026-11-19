import { useLiveQuery } from 'dexie-react-hooks';
import type { LocalDate } from '@/shared/kernel';
import type { PlanApi } from '../application/service';
import type { Block, TodayPlan } from '../domain/types';

// Reactive plan queries (docs/modules/plan.md §4, RN-PLN-26). They live in `ui` because
// useLiveQuery needs Dexie (spec 001 plan §6.3) and take the API as a parameter.
//
// useLiveQuery keeps the previous result while a new date is queried, so each result carries
// the date it belongs to and a mismatch reads as still loading. Query errors are thrown during
// render by useLiveQuery, for the route's error boundary (AC-21).

function useDatedQuery<T>(key: LocalDate, query: () => Promise<T>, plan: PlanApi): T | undefined {
  const dated = useLiveQuery(async () => ({ key, value: await query() }), [plan, key]);
  return dated?.key === key ? dated.value : undefined;
}

export function useTodayPlan(plan: PlanApi, date: LocalDate): TodayPlan | undefined {
  return useDatedQuery(date, () => plan.getTodayPlan(date), plan);
}

export function useWeekPlan(plan: PlanApi, weekStart: LocalDate): TodayPlan[] | undefined {
  return useDatedQuery(weekStart, () => plan.getWeekPlan(weekStart), plan);
}

// The blocks of the program (spec 006, RN-PLN-26). No parameter, so no key: undefined only while
// loading, as usePainSummary in health.
export function useBlocks(plan: PlanApi): Block[] | undefined {
  return useLiveQuery(() => plan.getBlocks(), [plan]);
}
