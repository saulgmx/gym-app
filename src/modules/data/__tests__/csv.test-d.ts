import { describe, expectTypeOf, it } from 'vitest';
import type { LocalDate, SeriesRow } from '@/shared/kernel';
import { CSV_COLUMNS, csvFilename, seriesCsv } from '../domain/csv';

// RN-DAT-14 (spec 008 plan §6.5): if SeriesRow changes, TypeScript forces a look at the CSV
// columns, which is when CSV_VERSION may need to go up (ADR-0013).

describe('CSV_COLUMNS', () => {
  it('RN-DAT-14: tiene exactamente las claves de SeriesRow, sin repetir', () => {
    expectTypeOf<(typeof CSV_COLUMNS)[number]>().toEqualTypeOf<keyof SeriesRow>();
    // 11 entries with 11 distinct keys: no key twice.
    expectTypeOf<(typeof CSV_COLUMNS)['length']>().toEqualTypeOf<11>();
  });
});

describe('seriesCsv y csvFilename', () => {
  it('RN-DAT-14: seriesCsv toma filas de solo lectura y devuelve texto; csvFilename toma una LocalDate', () => {
    expectTypeOf(seriesCsv).parameters.toEqualTypeOf<[readonly SeriesRow[]]>();
    expectTypeOf(seriesCsv).returns.toEqualTypeOf<string>();
    expectTypeOf(csvFilename).parameters.toEqualTypeOf<[LocalDate]>();
    expectTypeOf(csvFilename).returns.toEqualTypeOf<string>();
  });
});
