// Public API of the `training` module (docs/modules/training.md). The only file other modules may import.

import type { Dexie } from 'dexie';
import type { Clock, IdGenerator } from '@/shared/kernel';
import type { PlanReader, SuggestionProvider } from './application/ports';
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
}): TrainingApi {
  return createTrainingService({
    repository: createDexieTrainingRepository(deps.db),
    plan: deps.plan,
    suggestions: deps.suggestions,
    clock: deps.clock,
    ids: deps.ids,
  });
}

export { trainingStores } from './infrastructure/schema';

export type { TrainingApi } from './application/service';
export type {
  PlanReader,
  PrefillSuggestion,
  SuggestionProvider,
  WorkoutView,
} from './application/ports';
export type {
  ExerciseSession,
  InvalidSetValuesDetails,
  SetLog,
  TrainingError,
  TrainingErrorCode,
  Workout,
  WorkoutAlreadyActiveDetails,
  WorkoutItem,
} from './domain/types';
