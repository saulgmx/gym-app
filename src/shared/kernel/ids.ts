import type { ID, IdGenerator } from './types';

// Test IDs: zero-padded so string order matches creation order, as with UUIDv7.
export function sequentialIds(prefix = 'id'): IdGenerator {
  let count = 0;
  return {
    next: () => {
      count += 1;
      return `${prefix}-${String(count).padStart(4, '0')}` as ID;
    },
  };
}
