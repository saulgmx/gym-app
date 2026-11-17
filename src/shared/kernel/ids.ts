import type { ID, IdGenerator } from './types';

const MAX_COUNTER = 0xfff; // 12 bits in rand_a
const SEED_MASK = 0x7ff; // 11-bit seed leaves room before overflowing

// UUIDv7 (RFC 9562), monotonic per device with a counter in rand_a (§6.2 method 1, plan §6.5).
export function createUuidV7Generator(
  opts: {
    now?: () => number;
    random?: (bytes: Uint8Array) => void;
  } = {},
): IdGenerator {
  const now = opts.now ?? (() => Date.now());
  const random =
    opts.random ??
    ((bytes: Uint8Array<ArrayBuffer>) => {
      crypto.getRandomValues(bytes);
    });
  let lastMs = -1;
  let counter = 0;

  return {
    next: () => {
      const rand = new Uint8Array(10); // 8 for rand_b, 2 for the counter seed
      random(rand);
      const randView = new DataView(rand.buffer);
      const seed = randView.getUint16(8) & SEED_MASK;

      const ms = now();
      if (ms > lastMs) {
        lastMs = ms;
        counter = seed;
      } else if (counter < MAX_COUNTER) {
        // Same or earlier ms: keep lastMs so the ID still sorts after the previous one.
        counter += 1;
      } else {
        lastMs += 1;
        counter = seed;
      }

      const bytes = new Uint8Array(16);
      const view = new DataView(bytes.buffer);
      view.setUint16(0, Math.floor(lastMs / 2 ** 32));
      view.setUint32(2, lastMs % 2 ** 32);
      view.setUint16(6, 0x7000 | counter);
      bytes.set(rand.subarray(0, 8), 8);
      view.setUint8(8, 0x80 | (view.getUint8(8) & 0x3f));

      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as ID;
    },
  };
}

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
