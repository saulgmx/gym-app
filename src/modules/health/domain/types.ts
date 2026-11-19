import type { DomainError } from '@/shared/kernel';

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

export type HealthErrorCode = 'health/pain-out-of-range' | 'health/invalid-red-flag';
export type HealthError = DomainError<HealthErrorCode>;
