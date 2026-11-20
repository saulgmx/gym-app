import type { Result } from './result';
import type { ID, Instant, LocalDate } from './types';

// Export/import contract each module with data implements (docs/modules/data.md §3, shared.md §2).
// It lives in the kernel because no module may import `data`. `wipe` arrives with RF-43.

/** Preview figures; each field comes from a single port, and data merges them (RN-DAT-13). */
export interface ImportFacts {
  completedWorkouts?: number;
  doneSets?: number; // done sets of the completed workouts
  painEntries?: number;
  dateRange?: { from: LocalDate; to: LocalDate } | null;
  hasActiveWorkout?: boolean;
  programStartDate?: LocalDate;
}

/** What is on this device right now (RN-DAT-05, RN-DAT-13). */
export interface LocalFacts {
  completedWorkouts?: number;
  hasActiveWorkout?: boolean;
}

/** What validated data offers and needs, by kind of ID ('exercise', 'workout'), for RN-DAT-11. */
export interface DataDescription {
  facts: ImportFacts;
  provides: Record<string, readonly ID[]>;
  requires: Record<string, readonly ID[]>;
}

export interface DataPort<T = unknown> {
  name: string; // 'plan', 'training', 'health'
  version: number; // export format version of this module
  order: number; // import order: plan 10, training 20, health 30, progression 35, app 40
  tables: string[]; // Dexie tables it touches (for the single transaction)
  exportData(): Promise<T>; // rows as stored
  validate(raw: unknown, fromVersion: number): Result<T>; // migrates, Zod schema and module rules
  describe(data: T): DataDescription; // pure
  current(): Promise<LocalFacts>; // Dexie reads only: it also runs inside the import transaction
  importData(data: T): Promise<void>; // clears its tables and writes; runs inside the transaction
  seriesRows?(): Promise<SeriesRow[]>; // training only, already in RN-DAT-14 order (spec 008 plan §3)
}

/** One done set of a completed workout, as the series CSV shows it (RN-DAT-14, RN-TRN-31). */
export interface SeriesRow {
  date: LocalDate;
  week: number | null; // programWeek
  session: string; // Workout.name
  exercise: string; // current name of the set's exercise in the plan
  metric: 'weight' | 'reps' | 'time';
  setNumber: number;
  weightKg: number | null; // negative = assistance
  reps: number | null; // seconds when metric = 'time'
  rir: number | null;
  isExtra: boolean;
  completedAt: Instant | null; // null only for tolerated broken data (RN-DAT-12)
}
