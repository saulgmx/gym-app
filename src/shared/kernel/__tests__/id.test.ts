import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/shared/kernel';

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
