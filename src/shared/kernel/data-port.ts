import type { Result } from './result';
import type { ID, LocalDate } from './types';

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
  csv?(): Promise<{ filename: string; content: string }>;
}
