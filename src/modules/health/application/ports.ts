import type { ID } from '@/shared/kernel';
import type { PainEntry } from '../domain/types';

// What the health service needs from storage (docs/modules/health.md §4, contract v1.6).

export interface PainRepository {
  // RN-HLT-09: one rw transaction. `build` receives the entry of the workout (or undefined) and
  // returns the row to write, so the lookup and the write never interleave with another tab.
  upsertForWorkout(
    workoutId: ID,
    build: (existing: PainEntry | undefined) => PainEntry,
  ): Promise<PainEntry>;
  listAll(): Promise<PainEntry[]>; // any order; the service sorts (RN-HLT-14)
  existsForWorkout(workoutId: ID): Promise<boolean>;
}

// The port training reads before closing a workout (RN-TRN-06). Declared here with the same shape
// as training's, because health does not import training (no cycle, P-4).
export interface PainGate {
  hasPainEntry(workoutId: ID): Promise<boolean>;
}
