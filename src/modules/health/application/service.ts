import {
  compareInstants,
  ok,
  type Clock,
  type ID,
  type IdGenerator,
  type LocalDate,
  type Result,
} from '@/shared/kernel';
import { assessPain, checkPainInput, noticeOf, persistentAlert } from '../domain/pain';
import type {
  HealthError,
  PainAssessment,
  PainEntry,
  PainNoticeInfo,
  PersistentAlert,
  RedFlag,
} from '../domain/types';
import type { PainGate, PainRepository } from './ports';

// Use cases of the health module (docs/modules/health.md §4, contract v1.6). A storage failure
// rejects the promise as is (RN-HLT-16, ADR-0010).

// RN-HLT-17: fixed until Ajustes stores healthSettings (RF-51).
const PAIN_THRESHOLD = 3;

export interface PainSummary {
  latest: PainEntry | null;
  latestAssessment: PainAssessment | null;
  persistentAlert: PersistentAlert | null;
  notice: PainNoticeInfo | null;
  threshold: number;
}

export interface HealthApi {
  recordPain(
    workoutId: ID,
    input: { level: number; redFlags: RedFlag[]; date: LocalDate },
  ): Promise<Result<PainAssessment, HealthError>>;
  assessPain(level: number, redFlags: RedFlag[]): PainAssessment;
  getPainSummary(): Promise<PainSummary>;
  hasPainEntry(workoutId: ID): Promise<boolean>;
  // RN-HLT-20 (spec 006): the entry of each id that has one; [] answers without reading.
  getPainForWorkouts(workoutIds: ID[]): Promise<Map<ID, PainEntry>>;
  painGate: PainGate;
}

// RN-HLT-14: latest first by instant (never as strings, ADR-0009); equal instants by the greater id.
function latestFirst(entries: readonly PainEntry[]): PainEntry[] {
  return [...entries].sort((a, b) => {
    const byInstant = compareInstants(b.recordedAt, a.recordedAt);
    if (byInstant !== 0) return byInstant;
    // Greater id first; code-unit order, as UUIDv7 sorts (ADR-0009), not localeCompare.
    return Number(a.id < b.id) - Number(a.id > b.id);
  });
}

export function createHealthService(deps: {
  repository: PainRepository;
  clock: Clock;
  ids: IdGenerator;
}): HealthApi {
  const { repository, clock, ids } = deps;

  const hasPainEntry = (workoutId: ID) => repository.existsForWorkout(workoutId);

  return {
    // RN-HLT-09: validate first, without touching storage; replace everything but the id.
    async recordPain(workoutId, input) {
      const checked = checkPainInput(input.level, input.redFlags);
      if (!checked.ok) return checked;
      const { level, redFlags } = checked.value;
      const recordedAt = clock.now();
      await repository.upsertForWorkout(workoutId, (existing) => ({
        id: existing?.id ?? ids.next(),
        workoutId,
        date: input.date,
        recordedAt,
        level,
        redFlags,
      }));
      return ok(assessPain(level, redFlags));
    },

    assessPain,

    // RN-HLT-17
    async getPainSummary() {
      const ordered = latestFirst(await repository.listAll());
      const latest = ordered[0] ?? null;
      return {
        latest,
        latestAssessment: latest ? assessPain(latest.level, latest.redFlags) : null,
        persistentAlert: persistentAlert(ordered, PAIN_THRESHOLD),
        notice: noticeOf(ordered, PAIN_THRESHOLD),
        threshold: PAIN_THRESHOLD,
      };
    },

    // RN-HLT-20
    async getPainForWorkouts(workoutIds) {
      if (workoutIds.length === 0) return new Map();
      const found = await repository.findByWorkoutIds(workoutIds);
      return new Map(found.map((entry) => [entry.workoutId, entry]));
    },

    // RN-HLT-18: painGate is the same function.
    hasPainEntry,
    painGate: { hasPainEntry },
  };
}
