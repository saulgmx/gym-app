import type { DomainError, ID, Instant, LocalDate } from '@/shared/kernel';

// Domain model of `health` (docs/modules/health.md §3). Pure TypeScript.

export const RED_FLAGS = ['radiating', 'numbness', 'weakness', 'bladder_bowel'] as const;
export type RedFlag = (typeof RED_FLAGS)[number];

export type PainStatus = 'normal' | 'attention' | 'alert';

export interface PainAssessment {
  status: PainStatus;
  message: string;
  redFlagMessage?: string; // only with red flags; emergency text with bladder_bowel (RN-HLT-06)
  blocksProgression: boolean;
}

export interface PainEntry {
  id: ID;
  workoutId: ID;
  date: LocalDate;
  recordedAt: Instant;
  level: number; // integer 0-10 (RN-HLT-01)
  redFlags: RedFlag[];
}

// What the alert rules read from an entry; lists of these go latest first (RN-HLT-14).
/** A backup of the module's table (RN-HLT-21, spec 007). */
export interface HealthBackup {
  painEntries: PainEntry[];
}

export type PainReading = Pick<PainEntry, 'level' | 'redFlags'>;

export interface PersistentAlert {
  reason: 'over_threshold_2x' | 'rising_3x' | 'red_flag';
}

export type NoticeCause =
  'bladder_bowel' | 'red_flag' | 'alert' | 'over_threshold_2x' | 'rising_3x' | 'attention';

export interface PainNoticeInfo {
  cause: NoticeCause;
  message: string;
}

export type HealthErrorCode =
  'health/pain-out-of-range' | 'health/invalid-red-flag' | 'health/invalid-backup'; // RN-HLT-21 (spec 007)

/** details of health/invalid-backup (RN-HLT-21, contract v1.14 decision 16 (b)). */
export type InvalidBackupDetails =
  | { rule: 'schema'; issues: { path: string; code: string }[] }
  | { rule: 'unique-id'; id: ID }
  | { rule: 'one-per-workout'; workoutId: ID };
export type HealthError = DomainError<HealthErrorCode>;
