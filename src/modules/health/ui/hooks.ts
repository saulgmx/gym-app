import { useLiveQuery } from 'dexie-react-hooks';
import type { ID } from '@/shared/kernel';
import type { HealthApi, PainSummary } from '../application/service';
import type { PainEntry } from '../domain/types';

// Reactive health queries (docs/modules/health.md §4, RN-HLT-19). They live in `ui` because
// useLiveQuery needs Dexie (architecture §5.2) and take the API as a parameter.
//
// No key, unlike training's hooks: there are no parameters to go stale, and `health` is one
// instance per compose. undefined = loading; with no entries it is the empty summary (RN-HLT-17).
// Query errors are thrown during render by useLiveQuery, for the route's error boundary.
export function usePainSummary(health: HealthApi): PainSummary | undefined {
  return useLiveQuery(() => health.getPainSummary(), [health]);
}

// RN-HLT-20 (spec 006): this hook has a parameter, so its result carries the key it belongs to
// and another list reads as loading, as training's hooks do. The key is a string, so a new array
// with the same ids on each render does not query again. A UUIDv7 never contains '|'.
export function usePainForWorkouts(
  health: HealthApi,
  workoutIds: ID[],
): Map<ID, PainEntry> | undefined {
  const key = workoutIds.join('|');
  const keyed = useLiveQuery(
    async () => ({ key, value: await health.getPainForWorkouts(workoutIds) }),
    [health, key],
  );
  return keyed?.key === key ? keyed.value : undefined;
}
