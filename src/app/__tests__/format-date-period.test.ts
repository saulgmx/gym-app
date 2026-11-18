import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocalDate } from '@/shared/kernel';

// Spec 003 AC-1: iOS Safari writes the short month with a period ("nov."); Node and the
// Playwright WebKit do not, so neither the unit tests nor the e2e can see it. This test makes
// Intl behave like Safari and checks that formatShortDateTitle removes the period.

const RealDateTimeFormat = Intl.DateTimeFormat;

/** An Intl.DateTimeFormat whose short month ends in a period, as in Safari. */
function safariLikeFormat(
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const real = new RealDateTimeFormat(locales, options);
  if (options?.month !== 'short' || options.weekday) return real;
  return {
    format: (date?: Date | number) => `${real.format(date)}.`,
  } as Intl.DateTimeFormat;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('formatShortDateTitle with a period in the short month', () => {
  it('AC-1: "Miércoles 18 nov", no "nov."', async () => {
    vi.stubGlobal('Intl', { ...Intl, DateTimeFormat: safariLikeFormat });
    vi.resetModules();
    const { formatShortDateTitle } = await import('../format-date');

    expect(formatShortDateTitle('2026-11-18' as LocalDate)).toBe('Miércoles 18 nov');
    expect(formatShortDateTitle('2027-09-06' as LocalDate)).toBe('Lunes 6 sept');
  });
});
