import type { DataDescription, DomainError, Result } from '@/shared/kernel';
import type { HealthBackup } from './types';

// RN-HLT-21. Stubs until T10.
export function checkHealthBackup(_data: HealthBackup): Result<void, DomainError> {
  throw new Error('not implemented');
}

export function describeHealthBackup(_data: HealthBackup): DataDescription {
  throw new Error('not implemented');
}
