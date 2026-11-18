import { describe, expect, it } from 'vitest';
import { formatRange, formatSetCount, formatTarget } from '..';

// Texts of the session (docs/modules/training.md §4, v1.18; spec 004 plan §6.6, T3).

describe('formatRange', () => {
  it('AC-20: [6, 10] → "6-10"', () => {
    expect(formatRange([6, 10])).toBe('6-10');
  });

  it('AC-24: mínimo y máximo iguales → un solo número ("4", no "4-4")', () => {
    expect(formatRange([4, 4])).toBe('4');
  });
});

describe('formatTarget', () => {
  it('AC-5, AC-20: series planificadas × rango', () => {
    expect(formatTarget({ plannedSets: 2, repRange: [6, 10] }, 'weight')).toBe('2 × 6-10');
    expect(formatTarget({ plannedSets: 1, repRange: [8, 10] }, 'reps')).toBe('1 × 8-10');
  });

  it('AC-23: en ejercicios por tiempo, el rango va en segundos', () => {
    expect(formatTarget({ plannedSets: 2, repRange: [30, 45] }, 'time')).toBe('2 × 30-45 s');
  });

  it('un rango de un solo valor', () => {
    expect(formatTarget({ plannedSets: 3, repRange: [12, 12] }, 'weight')).toBe('3 × 12');
  });
});

describe('formatSetCount', () => {
  it('AC-21: "1 serie" en singular y "2 series" en plural', () => {
    expect(formatSetCount(1)).toBe('1 serie');
    expect(formatSetCount(2)).toBe('2 series');
    expect(formatSetCount(4)).toBe('4 series');
  });
});
