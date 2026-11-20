import type { ImportFacts, Instant, LocalFacts } from '@/shared/kernel';
import type { ImportPreview } from './types';

export function buildPreview(
  _h: { exportedAt: Instant; schemaVersion: number },
  _f: ImportFacts[],
  _l: LocalFacts[],
): ImportPreview {
  throw new Error('not implemented');
}
