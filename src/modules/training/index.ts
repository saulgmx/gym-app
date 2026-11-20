// Public API of the `training` module (docs/modules/training.md). The only file other modules may import.

import type { Dexie } from 'dexie';
import type { Clock, DataPort, IdGenerator } from '@/shared/kernel';
import type { PainGate, PlanReader, SuggestionProvider } from './application/ports';
import {
  createTrainingService,
  type TrainingApi as TrainingServiceApi,
} from './application/service';
import type { TrainingBackup } from './domain/types';
import { createSeriesReader } from './application/series';
import { createTrainingDataPort } from './infrastructure/data-port';
import { createDexieTrainingRepository } from './infrastructure/dexie-repository';

// The service plus the backup port (RN-TRN-30, spec 007), which lives in infrastructure, with the
// rows of the series CSV (RN-TRN-31, spec 008).
export interface TrainingApi extends TrainingServiceApi {
  dataPort: DataPort<TrainingBackup>;
}

// Wires the application service to Dexie (architecture §5.3). Ports come in as dependencies;
// compose resolves the cycle with progression in phase 4 (plan §6.2).
export function createTraining(deps: {
  db: Dexie;
  clock: Clock;
  ids: IdGenerator;
  plan: PlanReader;
  suggestions: SuggestionProvider;
  painGate: PainGate; // RN-TRN-06; health.painGate (spec 005)
}): TrainingApi {
  const repository = createDexieTrainingRepository(deps.db);
  const service = createTrainingService({
    repository,
    plan: deps.plan,
    suggestions: deps.suggestions,
    painGate: deps.painGate,
    clock: deps.clock,
    ids: deps.ids,
  });
  const seriesRows = createSeriesReader({ repository, plan: deps.plan });
  return { ...service, dataPort: createTrainingDataPort(deps.db, seriesRows) };
}

export { workoutProgress } from './application/progress';
export { historyDetail } from './domain/history';
export { workoutSummary } from './domain/summary';
export { trainingStores } from './infrastructure/schema';
export { formatDoneSet, formatRange, formatSetCount, formatTarget } from './ui/format';
export {
  useActiveWorkout,
  useActiveWorkoutView,
  useCompletedWorkouts,
  useLastSession,
  useWorkoutHistory,
  useWorkoutView,
} from './ui/hooks';
export { SetRow } from './ui/SetRow';
export { SessionHeader } from './ui/SessionHeader';
export { SetTable } from './ui/SetTable';

export type {
  HistoryEntry,
  PainGate,
  PlanReader,
  PrefillSuggestion,
  SuggestionProvider,
  WorkoutView,
} from './application/ports';
export type { WorkoutProgress } from './domain/progress';
export type { HistoryItem } from './domain/history';
export type { WorkoutSummary } from './domain/summary';
export type {
  ExerciseSession,
  InvalidBackupDetails,
  InvalidSetValuesDetails,
  SetErrorContext,
  SetLog,
  TrainingError,
  TrainingErrorCode,
  Workout,
  WorkoutAlreadyActiveDetails,
  WorkoutItem,
} from './domain/types';
