import { describe, expect, it } from 'vitest';
import { cx } from '../cx';

// modules/shared.md §4: cx joins CSS Module classes and always returns a string.

describe('cx', () => {
  it('joins classes and skips undefined, null and false', () => {
    const hidden = false as boolean;
    expect(cx('a', undefined, null, hidden && 'b', 'c')).toBe('a c');
  });

  it('returns an empty string when there are no classes', () => {
    expect(cx()).toBe('');
    expect(cx(undefined)).toBe('');
  });
});
