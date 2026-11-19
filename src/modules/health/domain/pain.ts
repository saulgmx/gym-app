import { err, ok, type Result } from '@/shared/kernel';
import { BAND_MESSAGES, EMERGENCY_MESSAGE, NOTICE_MESSAGES, RED_FLAG_MESSAGE } from './messages';
import {
  RED_FLAGS,
  type HealthError,
  type PainAssessment,
  type PainNoticeInfo,
  type PainReading,
  type PainStatus,
  type PersistentAlert,
  type RedFlag,
} from './types';

// Pain input, classification, persistent alert and the "Hoy" notice
// (docs/modules/health.md §4 and §6, contract v1.5).

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

/** RN-HLT-02: the text of a level's band. Trusts its input (0-10 from the selector). */
export function bandMessage(level: number): string {
  return BAND_MESSAGES[statusOf(level)];
}

/** RN-HLT-06: the red flag notice, the emergency one with bladder_bowel; undefined without flags. */
export function redFlagMessage(flags: readonly RedFlag[]): string | undefined {
  if (flags.length === 0) return undefined;
  return flags.includes('bladder_bowel') ? EMERGENCY_MESSAGE : RED_FLAG_MESSAGE;
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
  const flagMessage = redFlagMessage(flags);
  if (flagMessage !== undefined) assessment.redFlagMessage = flagMessage;
  return assessment;
}

// Contract v1.5: `latestFirst` comes ordered by the service (RN-HLT-14) and holds stored entries, which
// were validated when recorded; the threshold is a constant until Ajustes (RF-51). Nothing is
// re-validated and the input is never modified.

// RN-HLT-08: one reason, red_flag → over_threshold_2x → rising_3x (the order of RN-HLT-13).
export function persistentAlert(
  latestFirst: readonly PainReading[],
  threshold: number,
): PersistentAlert | null {
  const [latest, previous, oldest] = latestFirst;
  if (!latest) return null;
  if (latest.redFlags.length > 0) return { reason: 'red_flag' };
  if (!previous) return null;
  // RN-HLT-03, 04: only the 2 latest count, and "over" is strictly greater.
  if (latest.level > threshold && previous.level > threshold) {
    return { reason: 'over_threshold_2x' };
  }
  // RN-HLT-05: the 3 latest, strictly increasing in time. With integer levels ≥ 0 this already
  // makes the latest ≥ 2, so "the latest > 0" needs no check of its own.
  if (oldest && oldest.level < previous.level && previous.level < latest.level) {
    return { reason: 'rising_3x' };
  }
  return null;
}

// RN-HLT-12, 13: null exactly when no condition holds; otherwise the highest-priority cause.
export function noticeOf(
  latestFirst: readonly PainReading[],
  threshold: number,
): PainNoticeInfo | null {
  const [latest] = latestFirst;
  if (!latest) return null;
  const status = statusOf(latest.level);
  const alert = persistentAlert(latestFirst, threshold);

  if (latest.redFlags.includes('bladder_bowel')) {
    return { cause: 'bladder_bowel', message: NOTICE_MESSAGES.bladder_bowel };
  }
  if (latest.redFlags.length > 0) return { cause: 'red_flag', message: NOTICE_MESSAGES.red_flag };
  if (status === 'alert') return { cause: 'alert', message: NOTICE_MESSAGES.alert(latest.level) };
  if (alert?.reason === 'over_threshold_2x') {
    return { cause: 'over_threshold_2x', message: NOTICE_MESSAGES.over_threshold_2x(threshold) };
  }
  if (alert?.reason === 'rising_3x') {
    const chronological = latestFirst
      .slice(0, 3)
      .map((entry) => entry.level)
      .reverse();
    return { cause: 'rising_3x', message: NOTICE_MESSAGES.rising_3x(chronological) };
  }
  if (status === 'attention') {
    return { cause: 'attention', message: NOTICE_MESSAGES.attention(latest.level) };
  }
  return null;
}
