import { describe, expectTypeOf, it } from 'vitest';
import type * as z from 'zod/mini';
import type {
  ID,
  Instant,
  LocalDate,
  idSchema,
  instantSchema,
  localDateSchema,
} from '@/shared/kernel';

// The schemas hand back branded types (ADR-0009), so parsed input needs no cast.
describe('esquemas primitivos', () => {
  it('su salida es el tipo branded', () => {
    expectTypeOf<z.output<typeof idSchema>>().toEqualTypeOf<ID>();
    expectTypeOf<z.output<typeof localDateSchema>>().toEqualTypeOf<LocalDate>();
    expectTypeOf<z.output<typeof instantSchema>>().toEqualTypeOf<Instant>();
  });

  it('su entrada es un string suelto', () => {
    expectTypeOf<z.input<typeof idSchema>>().toEqualTypeOf<string>();
    expectTypeOf<z.input<typeof localDateSchema>>().toEqualTypeOf<string>();
    expectTypeOf<z.input<typeof instantSchema>>().toEqualTypeOf<string>();
  });
});
