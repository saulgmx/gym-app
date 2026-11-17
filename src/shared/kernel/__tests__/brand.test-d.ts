import { describe, expectTypeOf, it } from 'vitest';
import type { ID, Instant, LocalDate, Weekday } from '@/shared/kernel';

// ADR-0009: branded types keep IDs, dates and instants from being mixed up.
describe('tipos branded', () => {
  it('un string suelto no es ID, LocalDate ni Instant', () => {
    expectTypeOf<string>().not.toExtend<ID>();
    expectTypeOf<string>().not.toExtend<LocalDate>();
    expectTypeOf<string>().not.toExtend<Instant>();
  });

  it('no se mezclan entre sí', () => {
    expectTypeOf<ID>().not.toExtend<LocalDate>();
    expectTypeOf<LocalDate>().not.toExtend<Instant>();
    expectTypeOf<Instant>().not.toExtend<ID>();
  });

  it('siguen siendo strings para leerlos y guardarlos', () => {
    expectTypeOf<ID>().toExtend<string>();
    expectTypeOf<LocalDate>().toExtend<string>();
    expectTypeOf<Instant>().toExtend<string>();
  });

  it('Weekday va de 0 (domingo) a 6', () => {
    expectTypeOf<Weekday>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5 | 6>();
  });
});
