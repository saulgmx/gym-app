import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR_MESSAGE, errorMessages } from '../messages';

// ADR-0010 and spec 001 plan §6.8: every plan error code has a message, the generic one for now.

describe('errorMessages', () => {
  it('los 4 códigos de plan usan el mensaje genérico', () => {
    expect(errorMessages).toEqual({
      'plan/invalid-seed': GENERIC_ERROR_MESSAGE,
      'plan/high-risk-exercise': GENERIC_ERROR_MESSAGE,
      'plan/template-not-found': GENERIC_ERROR_MESSAGE,
      'plan/week-out-of-range': GENERIC_ERROR_MESSAGE,
    });
  });
});
