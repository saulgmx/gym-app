import type { Result } from '@/shared/kernel';
import type { DataError, Envelope, PortInfo } from './types';

export function checkVersions(_e: Envelope, _p: PortInfo[]): Result<void, DataError> {
  throw new Error('not implemented');
}

export function checkModules(_e: Envelope, _p: PortInfo[]): Result<void, DataError> {
  throw new Error('not implemented');
}
