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
    // @ts-expect-error: the value type must match T
    const wrongValue: Result<number, ParseError> = ok('5');
    // @ts-expect-error: the error code must be one of E's codes
    const wrongCode: Result<number, ParseError> = err({ code: 'other' as const, message: 'x' });
    void wrongValue;
    void wrongCode;
  });

  it('AC-16: if (!r.ok) estrecha el tipo a cada rama', () => {
    const r = parseReps('8');
    if (!r.ok) {
      expectTypeOf(r.error).toEqualTypeOf<ParseError>();
      expectTypeOf(r.error.code).toEqualTypeOf<'not-a-number' | 'negative'>();
      // @ts-expect-error: no value on the error branch
      void r.value;
      return;
    }
    expectTypeOf(r.value).toEqualTypeOf<number>();
    // @ts-expect-error: no error on the success branch
    void r.error;
  });

  it('AC-16: el error por omisión es DomainError', () => {
    expectTypeOf<Result<number>>().toEqualTypeOf<Result<number, DomainError>>();
  });
});
