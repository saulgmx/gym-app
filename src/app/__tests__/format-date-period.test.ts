import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalDate } from '@/shared/kernel';

// Short names with a period ("nov.", "lun."), as iOS Safari writes them. Node and the Playwright
// WebKit write them without one, so neither the other unit tests nor the e2e notice if the
// period removal goes away. Here Intl adds the period and the formats must remove it.

const RealDateTimeFormat = Intl.DateTimeFormat;

/** An Intl.DateTimeFormat whose short month and short weekday end in a period. */
function safariLikeFormat(
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const real = new RealDateTimeFormat(locales, options);
  if (options?.month !== 'short' && options?.weekday !== 'short') return real;
  return {
    format: (date?: Date | number) => `${real.format(date)}.`,
  } as Intl.DateTimeFormat;
}

/** format-date.ts built with the Safari-like Intl (its formatters are created on import). */
async function importFormatDate() {
  // Intl's members are not enumerable, so a spread would copy none: inherit them instead.
  vi.stubGlobal(
    'Intl',
    Object.assign(Object.create(Intl) as typeof Intl, {
      DateTimeFormat: safariLikeFormat,
    }),
  );
  vi.resetModules();
  return import('../format-date');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('short names with a period', () => {
  it('spec 003 AC-1: formatShortDateTitle → "Miércoles 18 nov", no "nov."', async () => {
    const { formatShortDateTitle } = await importFormatDate();

    expect(formatShortDateTitle('2026-11-18' as LocalDate)).toBe('Miércoles 18 nov');
    expect(formatShortDateTitle('2027-09-06' as LocalDate)).toBe('Lunes 6 sept');
  });

  it('spec 002 AC-7: formatShortDay → "Lun 16", no "Lun. 16"', async () => {
    const { formatShortDay } = await importFormatDate();

    expect(formatShortDay('2026-11-16' as LocalDate)).toBe('Lun 16');
    expect(formatShortDay('2026-11-20' as LocalDate)).toBe('Vie 20');
  });
});
