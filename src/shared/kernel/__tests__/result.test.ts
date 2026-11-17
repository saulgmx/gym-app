import { describe, expect, it } from 'vitest';
import { err, ok } from '@/shared/kernel';

// Runtime half of AC-16; the narrowing is checked in result.test-d.ts.
describe('ok y err', () => {
  it('AC-16: ok envuelve el valor', () => {
    expect(ok(5)).toEqual({ ok: true, value: 5 });
  });

  it('AC-16: err envuelve el error', () => {
    const error = { code: 'negative', message: 'negative: -1' };
    expect(err(error)).toEqual({ ok: false, error });
  });
});
