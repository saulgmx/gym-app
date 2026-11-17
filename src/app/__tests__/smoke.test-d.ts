import { describe, expectTypeOf, it } from 'vitest';

describe('type tests setup', () => {
  it('checks types at compile time', () => {
    expectTypeOf<'Hoy'>().toEqualTypeOf<'Hoy'>();
  });
});
