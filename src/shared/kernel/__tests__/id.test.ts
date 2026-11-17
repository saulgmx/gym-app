import { describe, expect, it } from 'vitest';
import { createUuidV7Generator, sequentialIds, type ID } from '@/shared/kernel';

// RFC 9562 layout: unix_ts_ms (48) | ver (4) | rand_a (12) | var (2) | rand_b (62).
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const timestampOf = (id: ID): number => parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
const counterOf = (id: ID): number => parseInt(id.slice(15, 18), 16);

// Filling every random byte with one value makes the counter seed 0 (0x00) or 0x7ff (0xff).
const fillWith = (byte: number) => (bytes: Uint8Array) => {
  bytes.fill(byte);
};

const T = Date.parse('2026-11-16T22:30:00-06:00');

describe('createUuidV7Generator', () => {
  it('AC-10: genera un UUIDv7 en minúsculas con versión 7 y variante 10xx', () => {
    const id = createUuidV7Generator().next();
    expect(id).toMatch(UUID_V7);
  });

  it('AC-10: su timestamp decodificado es el Date.now() del momento', () => {
    const before = Date.now();
    const id = createUuidV7Generator().next();
    const after = Date.now();
    expect(timestampOf(id)).toBeGreaterThanOrEqual(before);
    expect(timestampOf(id)).toBeLessThanOrEqual(after);
  });

  it('AC-10: usa el reloj inyectado', () => {
    const id = createUuidV7Generator({ now: () => T }).next();
    expect(timestampOf(id)).toBe(T);
    expect(id.slice(0, 13)).toBe('01a1e7c4-d940');
  });

  it('AC-10: la versión y la variante se fuerzan aunque el azar traiga otros bits', () => {
    const ones = createUuidV7Generator({ now: () => T, random: fillWith(0xff) }).next();
    const zeros = createUuidV7Generator({ now: () => T, random: fillWith(0x00) }).next();
    expect(ones).toMatch(UUID_V7);
    expect(zeros).toMatch(UUID_V7);
    expect(ones.slice(19)).toBe('bfff-ffffffffffff');
    expect(zeros.slice(19)).toBe('8000-000000000000');
  });

  it('AC-11: 10 000 IDs en el mismo ms son únicos y ordenados', () => {
    const ids = createUuidV7Generator({ now: () => T });
    const generated = Array.from({ length: 10_000 }, () => ids.next());
    expect(new Set(generated).size).toBe(10_000);
    expect([...generated].sort()).toEqual(generated);
  });

  it('AC-11: en el mismo ms el contador sube de uno en uno', () => {
    const ids = createUuidV7Generator({ now: () => T, random: fillWith(0x00) });
    const [a, b, c] = [ids.next(), ids.next(), ids.next()];
    expect([counterOf(a), counterOf(b), counterOf(c)]).toEqual([0, 1, 2]);
    expect([timestampOf(a), timestampOf(b), timestampOf(c)]).toEqual([T, T, T]);
  });

  it('el contador arranca con 11 bits aleatorios en cada ms nuevo', () => {
    let now = T;
    const ids = createUuidV7Generator({ now: () => now, random: fillWith(0xff) });
    expect(counterOf(ids.next())).toBe(0x7ff);
    ids.next();
    now = T + 1;
    expect(counterOf(ids.next())).toBe(0x7ff);
  });

  it('AC-12: si el reloj retrocede, el ID nuevo sigue siendo mayor', () => {
    let now = T;
    const ids = createUuidV7Generator({ now: () => now, random: fillWith(0x00) });
    const first = ids.next();
    now = T - 60_000;
    const second = ids.next();
    expect(second > first).toBe(true);
    expect(timestampOf(second)).toBe(T);
    expect(counterOf(second)).toBe(counterOf(first) + 1);
  });

  it('AC-12: al desbordarse el contador pasa a lastMs + 1 y sigue ordenado', () => {
    const ids = createUuidV7Generator({ now: () => T, random: fillWith(0xff) });
    // Seed 0x7ff leaves 0x7ff..0xfff: 2049 IDs fit in T.
    const sameMs = Array.from({ length: 2049 }, () => ids.next());
    expect(sameMs.every((id) => timestampOf(id) === T)).toBe(true);
    expect(counterOf(sameMs.at(-1) as ID)).toBe(0xfff);

    const overflow = ids.next();
    expect(timestampOf(overflow)).toBe(T + 1);
    expect(overflow > (sameMs.at(-1) as ID)).toBe(true);
  });

  it('AC-12: después de adelantarse, no retrocede cuando el reloj real alcanza ese ms', () => {
    let now = T;
    const ids = createUuidV7Generator({ now: () => now, random: fillWith(0xff) });
    let last = ids.next();
    for (let i = 0; i < 2049; i++) last = ids.next(); // overflow into T + 1
    now = T + 1;
    const next = ids.next();
    expect(timestampOf(next)).toBe(T + 1);
    expect(next > last).toBe(true);
  });
});

describe('sequentialIds', () => {
  it('genera IDs legibles con el prefijo por omisión', () => {
    const ids = sequentialIds();
    expect([ids.next(), ids.next(), ids.next()]).toEqual(['id-0001', 'id-0002', 'id-0003']);
  });

  it('acepta un prefijo', () => {
    expect(sequentialIds('workout').next()).toBe('workout-0001');
  });

  it('cada generador lleva su propia cuenta', () => {
    const a = sequentialIds();
    const b = sequentialIds();
    a.next();
    expect(b.next()).toBe('id-0001');
  });

  it('el orden del string coincide con el de creación', () => {
    const ids = sequentialIds();
    const generated = Array.from({ length: 120 }, () => ids.next());
    expect([...generated].sort()).toEqual(generated);
  });
});
