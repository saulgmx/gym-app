import { describe, expect, it } from 'vitest';
import type { ID } from '@/shared/kernel';
import { formatDoneSet, formatRange, formatSetCount, formatTarget, type SetLog } from '..';

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

describe('formatDoneSet (spec 006)', () => {
  const set = (v: Partial<SetLog>): SetLog => ({
    id: 's' as ID,
    workoutId: 'w' as ID,
    exerciseId: 'e' as ID,
    setNumber: 1,
    weightKg: 100,
    reps: 10,
    rir: 2,
    done: true,
    isExtra: false,
    ...v,
  });

  it('spec 006 AC-20: kilos × reps · RIR, con coma decimal', () => {
    expect(formatDoneSet(set({}), 'weight')).toBe('100 × 10 · RIR 2');
    expect(formatDoneSet(set({ weightKg: 62.5, reps: 8, rir: 1 }), 'weight')).toBe(
      '62,5 × 8 · RIR 1',
    );
  });

  it('spec 006 AC-23: asistencia (peso negativo)', () => {
    expect(formatDoneSet(set({ weightKg: -20, reps: 8 }), 'weight')).toBe('Asist. 20 × 8 · RIR 2');
  });

  it('spec 006 AC-24: por repeticiones solo las reps, y por tiempo los segundos', () => {
    expect(formatDoneSet(set({ weightKg: null, reps: 12, rir: 1 }), 'reps')).toBe('12 · RIR 1');
    expect(formatDoneSet(set({ weightKg: null, reps: 40 }), 'time')).toBe('40 s · RIR 2');
  });

  it('RN-TRN-04: una serie hecha sin RIR omite " · RIR"', () => {
    expect(formatDoneSet(set({ rir: null }), 'weight')).toBe('100 × 10');
  });

  it('RIR 0 se muestra (no se confunde con "sin RIR")', () => {
    expect(formatDoneSet(set({ rir: 0 }), 'weight')).toBe('100 × 10 · RIR 0');
  });
});
