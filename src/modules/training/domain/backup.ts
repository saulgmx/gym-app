import type { DataDescription, DomainError, Result } from '@/shared/kernel';
import type { TrainingBackup } from './types';

// RN-TRN-30. Stubs until T8.
export function checkTrainingBackup(_data: TrainingBackup): Result<void, DomainError> {
  throw new Error('not implemented');
}

export function describeTrainingBackup(_data: TrainingBackup): DataDescription {
  throw new Error('not implemented');
}
