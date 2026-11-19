import { err, ok, type Result } from '@/shared/kernel';
import { BAND_MESSAGES, EMERGENCY_MESSAGE, RED_FLAG_MESSAGE } from './messages';
import {
  RED_FLAGS,
  type HealthError,
  type PainAssessment,
  type PainStatus,
  type RedFlag,
} from './types';

// Pain input and classification (docs/modules/health.md §4 and §6, contract v1.4).

export interface PainInput {
  level: number;
  redFlags: RedFlag[];
}

const MIN_LEVEL = 0;
const MAX_LEVEL = 10;

const isRedFlag = (value: string): value is RedFlag =>
  (RED_FLAGS as readonly string[]).includes(value);

// RN-HLT-01 first, then RN-HLT-15; only the first problem is reported.
export function checkPainInput(
  level: number,
  redFlags: readonly RedFlag[],
): Result<PainInput, HealthError> {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    return err({
      code: 'health/pain-out-of-range',
      message: `Pain level ${String(level)} is not an integer in [0, 10] (RN-HLT-01)`,
    });
  }
  const seen = new Set<RedFlag>();
  for (const flag of redFlags) {
    if (!isRedFlag(flag) || seen.has(flag)) {
      return err({
        code: 'health/invalid-red-flag',
        message: `Red flag "${flag}" is unknown or repeated (RN-HLT-15)`,
      });
    }
    seen.add(flag);
  }
  // `+ 0` turns -0 into 0 (RN-HLT-01).
  return ok({ level: level + 0, redFlags: [...redFlags] });
}

// RN-HLT-02: fixed bands, independent of the pain threshold.
function statusOf(level: number): PainStatus {
  if (level >= 7) return 'alert';
  if (level >= 4) return 'attention';
  return 'normal';
}

// RN-HLT-02, 06, 07. Invalid input is a programming error (like RN-PLN-16): it throws.
export function assessPain(level: number, redFlags: readonly RedFlag[]): PainAssessment {
  const checked = checkPainInput(level, redFlags);
  if (!checked.ok) throw new Error(checked.error.message);

  const status = statusOf(checked.value.level);
  const flags = checked.value.redFlags;
  const assessment: PainAssessment = {
    status,
    message: BAND_MESSAGES[status],
    blocksProgression: status === 'alert' || flags.length > 0,
  };
  if (flags.length > 0) {
    assessment.redFlagMessage = flags.includes('bladder_bowel')
      ? EMERGENCY_MESSAGE
      : RED_FLAG_MESSAGE;
  }
  return assessment;
}
