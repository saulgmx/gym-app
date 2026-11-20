import type { DomainError, Instant, LocalDate } from '@/shared/kernel';

// Types of the data module (docs/modules/data.md §5, §7).

export type DataErrorCode =
  | 'data/file-too-large'
  | 'data/not-gym-app-file'
  | 'data/unsupported-version'
  | 'data/invalid-module-data'
  | 'data/workout-in-progress';

export type DataError = DomainError<DataErrorCode>;

export interface InvalidModuleDataDetails {
  module: string | null; // null: the envelope (modules missing or unexpected)
  cause: string; // the port's code, 'data/module-mismatch' or 'data/missing-reference'
  details?: unknown;
}

export interface UnsupportedVersionDetails {
  module: string | null; // null: schemaVersion
  version: number;
  supported: number;
}

/** A registered port as the pure review sees it: name and current version, in `order`. */
export interface PortInfo {
  name: string;
  version: number;
}

/** The parsed file, before each module's data is validated by its port. */
export interface Envelope {
  schemaVersion: number;
  exportedAt: Instant;
  modules: Record<string, { version: number; data: unknown }>;
}

/** RN-DAT-13. */
export interface ImportPreview {
  exportedAt: Instant;
  schemaVersion: number;
  completedWorkouts: number;
  doneSets: number;
  painEntries: number;
  dateRange: { from: LocalDate; to: LocalDate } | null;
  hasActiveWorkout: boolean;
  programStartDate: LocalDate;
  currentCompletedWorkouts: number;
}
