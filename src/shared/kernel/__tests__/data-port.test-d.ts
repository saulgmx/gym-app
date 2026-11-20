import { describe, expectTypeOf, it } from 'vitest';
import {
  ok,
  type DataDescription,
  type DataPort,
  type ID,
  type ImportFacts,
  type Instant,
  type LocalDate,
  type LocalFacts,
  type SeriesRow,
} from '@/shared/kernel';

// DataPort after spec 007 plan §3 and spec 008 plan §3 (shared.md §2): describe and current,
// seriesRows instead of csv, no wipe.
interface Rows {
  rows: { id: ID; date: LocalDate }[];
}

const example: DataPort<Rows> = {
  name: 'example',
  version: 1,
  order: 10,
  tables: ['rows'],
  exportData: () => Promise.resolve({ rows: [] }),
  validate: () => ok({ rows: [] }),
  describe: (data) => ({
    facts: { completedWorkouts: data.rows.length },
    provides: { workout: data.rows.map((r) => r.id) },
    requires: {},
  }),
  current: () => Promise.resolve({ hasActiveWorkout: false }),
  importData: () => Promise.resolve(),
};

describe('DataPort', () => {
  it('un puerto con describe y current compila sin seriesRows', () => {
    expectTypeOf(example).toExtend<DataPort<Rows>>();
  });

  it('RN-TRN-31: seriesRows es opcional y devuelve Promise<SeriesRow[]>', () => {
    expectTypeOf<DataPort['seriesRows']>().toEqualTypeOf<
      (() => Promise<SeriesRow[]>) | undefined
    >();
    const withRows: DataPort<Rows> = { ...example, seriesRows: () => Promise.resolve([]) };
    expectTypeOf(withRows).toExtend<DataPort<Rows>>();
  });

  it('spec 008: ya no tiene csv (lo reemplaza seriesRows)', () => {
    expectTypeOf<DataPort>().not.toHaveProperty('csv');
  });

  it('RN-DAT-14: SeriesRow tiene exactamente las columnas del CSV, con sus tipos', () => {
    expectTypeOf<SeriesRow>().toEqualTypeOf<{
      date: LocalDate;
      week: number | null;
      session: string;
      exercise: string;
      metric: 'weight' | 'reps' | 'time';
      setNumber: number;
      weightKg: number | null;
      reps: number | null;
      rir: number | null;
      isExtra: boolean;
      completedAt: Instant | null;
    }>();
  });

  it('describe es pura sobre los datos validados y current es asíncrona', () => {
    expectTypeOf<DataPort<Rows>['describe']>().parameters.toEqualTypeOf<[Rows]>();
    expectTypeOf<DataPort<Rows>['describe']>().returns.toEqualTypeOf<DataDescription>();
    expectTypeOf<DataPort['current']>().returns.toEqualTypeOf<Promise<LocalFacts>>();
  });

  it('sin describe o sin current no es un DataPort', () => {
    // describe y current son obligatorios (spec 007 plan §6.4)
    expectTypeOf<Omit<DataPort<Rows>, 'describe'>>().not.toExtend<DataPort<Rows>>();
    expectTypeOf<Omit<DataPort<Rows>, 'current'>>().not.toExtend<DataPort<Rows>>();
  });

  it('ya no tiene wipe (entra con RF-43)', () => {
    expectTypeOf<DataPort>().not.toHaveProperty('wipe');
  });

  it('ImportFacts y LocalFacts son parciales: cada puerto aporta sus campos', () => {
    expectTypeOf<Partial<ImportFacts>>().toEqualTypeOf<ImportFacts>();
    expectTypeOf<Partial<LocalFacts>>().toEqualTypeOf<LocalFacts>();
    expectTypeOf<ImportFacts['dateRange']>().toEqualTypeOf<
      { from: LocalDate; to: LocalDate } | null | undefined
    >();
    expectTypeOf<DataDescription['provides']>().toEqualTypeOf<Record<string, readonly ID[]>>();
  });
});
