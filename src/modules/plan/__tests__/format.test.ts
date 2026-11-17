import { describe, expect, it } from 'vitest';
import { formatRange, formatRir, formatSetsReps } from '../ui/format';

// Texts of the "Hoy" list (spec 001 AC-15, plan §6.10).

describe('format', () => {
  it('un rango con mínimo igual al máximo es un solo número', () => {
    expect(formatRange([3, 4])).toBe('3-4');
    expect(formatRange([4, 4])).toBe('4');
  });

  it('series × reps, con "s" si la métrica es tiempo', () => {
    expect(formatSetsReps(2, [8, 12], 'weight')).toBe('2 × 8-12');
    expect(formatSetsReps(2, [8, 10], 'reps')).toBe('2 × 8-10');
    expect(formatSetsReps(3, [30, 45], 'time')).toBe('3 × 30-45 s');
    expect(formatSetsReps(3, [10, 10], 'weight')).toBe('3 × 10');
  });

  it('RIR', () => {
    expect(formatRir([3, 4])).toBe('RIR 3-4');
    expect(formatRir([4, 4])).toBe('RIR 4');
  });
});
