// Public API of the `training` module (docs/modules/training.md). The only file other modules may import.

import type { Dexie } from 'dexie';
import type { Clock, IdGenerator } from '@/shared/kernel';
import type { PainGate, PlanReader, SuggestionProvider } from './application/ports';
import { createTrainingService, type TrainingApi } from './application/service';
import { createDexieTrainingRepository } from './infrastructure/dexie-repository';

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
  return createTrainingService({
    repository: createDexieTrainingRepository(deps.db),
    plan: deps.plan,
    suggestions: deps.suggestions,
    painGate: deps.painGate,
    clock: deps.clock,
    ids: deps.ids,
  });
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

export type { TrainingApi } from './application/service';
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
  InvalidSetValuesDetails,
  SetErrorContext,
  SetLog,
  TrainingError,
  TrainingErrorCode,
  Workout,
  WorkoutAlreadyActiveDetails,
  WorkoutItem,
} from './domain/types';
