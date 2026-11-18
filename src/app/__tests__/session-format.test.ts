import { describe, expect, it } from 'vitest';
import { formatExitSummary, formatNextLine } from '../pages/session/format';

// Texts of the session page (spec 004 §6.3 and §6.6, plan §6.7; T7).

describe('formatExitSummary', () => {
  it('AC-12: ejercicios hechos y tiempo de entrenamiento', () => {
    expect(formatExitSummary(1, 7, '18:42')).toBe(
      'Llevas 1 de 7 ejercicios y 18:42 de entrenamiento.',
    );
    expect(formatExitSummary(0, 6, '1:05:12')).toBe(
      'Llevas 0 de 6 ejercicios y 1:05:12 de entrenamiento.',
    );
  });

  it('AC-18: sin tiempo (sesión de otro día), solo los ejercicios', () => {
    expect(formatExitSummary(1, 7, null)).toBe('Llevas 1 de 7 ejercicios.');
  });

  it('"ejercicio" concuerda con el total, como en "Hoy"', () => {
    expect(formatExitSummary(0, 1, null)).toBe('Llevas 0 de 1 ejercicio.');
    expect(formatExitSummary(1, 1, '5:00')).toBe(
      'Llevas 1 de 1 ejercicio y 5:00 de entrenamiento.',
    );
  });
});

describe('formatNextLine', () => {
  it('AC-31, AC-32: el siguiente ejercicio con su objetivo', () => {
    expect(formatNextLine({ name: 'Press de banca con barra', target: '2 × 6-10' })).toBe(
      'Siguiente: Press de banca con barra · 2 × 6-10',
    );
  });

  it('AC-34: con un objetivo en segundos', () => {
    expect(formatNextLine({ name: 'Plancha', target: '2 × 30-45 s' })).toBe(
      'Siguiente: Plancha · 2 × 30-45 s',
    );
  });

  it('AC-33: en el último, "Último ejercicio de hoy", también en una sesión de otro día', () => {
    expect(formatNextLine(null)).toBe('Último ejercicio de hoy');
  });
});
