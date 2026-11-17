import { describe, expectTypeOf, it } from 'vitest';
import { err, ok, type DomainError, type Result } from '@/shared/kernel';

type ParseError = DomainError<'not-a-number' | 'negative'>;

function parseReps(input: string): Result<number, ParseError> {
  const n = Number(input);
  if (Number.isNaN(n)) return err({ code: 'not-a-number', message: `not a number: ${input}` });
  if (n < 0) return err({ code: 'negative', message: `negative: ${input}` });
  return ok(n);
}

describe('Result', () => {
  it('AC-16: ok y err producen Result con el lado vacío en never', () => {
    expectTypeOf(ok(5)).toEqualTypeOf<Result<number, never>>();
    const e = { code: 'negative', message: 'x' } as const satisfies ParseError;
    expectTypeOf(err(e)).toEqualTypeOf<Result<never, typeof e>>();
  });

  it('AC-16: ok y err se asignan a un Result<T, E> tipado', () => {
    expectTypeOf(ok(5)).toExtend<Result<number, ParseError>>();
    expectTypeOf(err({ code: 'negative' as const, message: 'x' })).toExtend<
      Result<number, ParseError>
    >();
    // The value type must match T, and the error code must be one of E's codes.
    expectTypeOf(ok('5')).not.toExtend<Result<number, ParseError>>();
    expectTypeOf(err({ code: 'other' as const, message: 'x' })).not.toExtend<
      Result<number, ParseError>
    >();
  });

  it('AC-16: if (!r.ok) estrecha el tipo a cada rama', () => {
    const r = parseReps('8');
    if (!r.ok) {
      expectTypeOf(r.error).toEqualTypeOf<ParseError>();
      expectTypeOf(r.error.code).toEqualTypeOf<'not-a-number' | 'negative'>();
      expectTypeOf(r).not.toHaveProperty('value');
      return;
    }
    expectTypeOf(r.value).toEqualTypeOf<number>();
    expectTypeOf(r).not.toHaveProperty('error');
  });

  it('AC-16: el error por omisión es DomainError', () => {
    expectTypeOf<Result<number>>().toEqualTypeOf<
      { ok: true; value: number } | { ok: false; error: DomainError }
    >();
  });
});
