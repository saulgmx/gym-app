import type { DataDescription, ID } from '@/shared/kernel';

export function missingReference(
  _d: { name: string; description: DataDescription }[],
): { module: string; kind: string; id: ID } | null {
  throw new Error('not implemented');
}
