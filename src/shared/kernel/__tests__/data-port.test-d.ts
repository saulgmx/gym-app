import { describe, expectTypeOf, it } from 'vitest';
import {
  ok,
  type DataDescription,
  type DataPort,
  type ID,
  type ImportFacts,
  type LocalDate,
  type LocalFacts,
} from '@/shared/kernel';

// DataPort after spec 007 plan §3 (shared.md §2): describe and current, no wipe.
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
  it('un puerto con describe y current compila; csv es opcional', () => {
    expectTypeOf(example).toExtend<DataPort<Rows>>();
    expectTypeOf<DataPort['csv']>().toEqualTypeOf<
      (() => Promise<{ filename: string; content: string }>) | undefined
    >();
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
