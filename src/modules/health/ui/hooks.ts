import { useLiveQuery } from 'dexie-react-hooks';
import type { HealthApi, PainSummary } from '../application/service';

// Reactive health queries (docs/modules/health.md §4, RN-HLT-19). They live in `ui` because
// useLiveQuery needs Dexie (architecture §5.2) and take the API as a parameter.
//
// No key, unlike training's hooks: there are no parameters to go stale, and `health` is one
// instance per compose. undefined = loading; with no entries it is the empty summary (RN-HLT-17).
// Query errors are thrown during render by useLiveQuery, for the route's error boundary.
export function usePainSummary(health: HealthApi): PainSummary | undefined {
  return useLiveQuery(() => health.getPainSummary(), [health]);
}
