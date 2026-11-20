import { describe, expect, it } from 'vitest';
import { createUuidV7Generator, idSchema, instantSchema, localDateSchema } from '@/shared/kernel';

// Primitive schemas for external input (shared.md §2, spec 007 plan §6.6).
const accepts = (schema: { safeParse(v: unknown): { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('idSchema', () => {
  it('RN-PLN-24 (b): acepta un UUIDv7 en minúsculas y lo devuelve igual', () => {
    const id = createUuidV7Generator().next();
    expect(idSchema.parse(id)).toBe(id);
  });

  it('RN-PLN-24 (b): rechaza mayúsculas, otras versiones y lo que no es UUID', () => {
    const id = createUuidV7Generator().next();
    expect(accepts(idSchema, id.toUpperCase())).toBe(false);
    expect(accepts(idSchema, '0b5f8a3e-6d1c-4b2a-9f00-1c2d3e4f5a6b')).toBe(false); // v4
    expect(accepts(idSchema, 'id-0001')).toBe(false);
    expect(accepts(idSchema, 42)).toBe(false);
  });
});

describe('localDateSchema', () => {
  it('acepta una fecha real AAAA-MM-DD, también el 29 de febrero de un año bisiesto', () => {
    expect(localDateSchema.parse('2026-11-16')).toBe('2026-11-16');
    expect(accepts(localDateSchema, '2024-02-29')).toBe(true);
  });

  it('no limita el rango de años (spec 007 T1)', () => {
    expect(accepts(localDateSchema, '1999-12-31')).toBe(true);
    expect(accepts(localDateSchema, '2150-01-01')).toBe(true);
  });

  it('rechaza fechas imposibles, formato corto, con hora y lo que no es texto', () => {
    expect(accepts(localDateSchema, '2026-02-30')).toBe(false);
    expect(accepts(localDateSchema, '2025-02-29')).toBe(false);
    expect(accepts(localDateSchema, '2026-13-01')).toBe(false);
    expect(accepts(localDateSchema, '2026-1-5')).toBe(false);
    expect(accepts(localDateSchema, '2026-11-16T00:00')).toBe(false);
    expect(accepts(localDateSchema, 20261116)).toBe(false);
  });
});

describe('instantSchema', () => {
  it('acepta lo que escribe systemClock (offset ±HH:MM) y lo devuelve igual', () => {
    expect(instantSchema.parse('2026-11-19T22:30:00-06:00')).toBe('2026-11-19T22:30:00-06:00');
    expect(accepts(instantSchema, '2026-11-19T22:30:00+05:30')).toBe(true);
  });

  it('acepta Z y fracciones de segundo (spec 007 T1)', () => {
    expect(accepts(instantSchema, '2026-11-20T04:30:00Z')).toBe(true);
    expect(accepts(instantSchema, '2026-11-19T22:30:00.123-06:00')).toBe(true);
  });

  it('rechaza sin offset, sin segundos, offset sin dos puntos, con espacio y fechas u horas imposibles', () => {
    expect(accepts(instantSchema, '2026-11-19T22:30:00')).toBe(false);
    expect(accepts(instantSchema, '2026-11-19T22:30-06:00')).toBe(false);
    expect(accepts(instantSchema, '2026-11-19T22:30:00+0600')).toBe(false);
    expect(accepts(instantSchema, '2026-11-19 22:30:00Z')).toBe(false);
    expect(accepts(instantSchema, '2026-02-30T10:00:00Z')).toBe(false);
    expect(accepts(instantSchema, '2026-11-19T25:00:00Z')).toBe(false);
    expect(accepts(instantSchema, '2026-11-16')).toBe(false);
  });
});
