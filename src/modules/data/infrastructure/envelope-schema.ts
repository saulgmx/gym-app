import type { Result } from '@/shared/kernel';
import type { DataError, Envelope } from '../domain/types';

export function parseEnvelope(_text: string): Result<Envelope, DataError> {
  throw new Error('not implemented');
}
