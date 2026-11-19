import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/shared/kernel';
import { formatLongDate, formatShortDateTitle, formatWeekday } from '../format-date';
import {
  formatCurrent,
  formatItemsDone,
  formatRemaining,
  formatSessionSummary,
  formatTrainedToday,
  formatWeekSessions,
} from '../pages/today/format';
import { formatElapsed } from '../format-time';

// Texts of "Hoy" (spec 003 plan §6.7). Expected values computed with Node (Node 24, Intl es, ICU 78.3).

const date = (s: string) => s as LocalDate;

describe('formatShortDateTitle', () => {
  it('AC-1: "Miércoles 18 nov", con mayúscula inicial y sin punto en el mes', () => {
    expect(formatShortDateTitle(date('2026-11-18'))).toBe('Miércoles 18 nov');
    expect(formatShortDateTitle(date('2026-11-16'))).toBe('Lunes 16 nov');
  });

  // Node prints the short month without a period; the period of Safari ("nov.") is checked in
  // format-date-period.test.ts, which makes Intl write it.
  it('otros meses, incluido "sept"', () => {
    expect(formatShortDateTitle(date('2027-02-22'))).toBe('Lunes 22 feb');
    expect(formatShortDateTitle(date('2026-12-31'))).toBe('Jueves 31 dic');
    expect(formatShortDateTitle(date('2027-09-06'))).toBe('Lunes 6 sept');
  });
});

// Spec 005b plan §6.5: the weekday alone, in lower case, for "Full body A del viernes".
describe('formatWeekday', () => {
  it('spec 005b AC-9: los siete días en minúsculas, con acento en miércoles y sábado', () => {
    expect(
      ['16', '17', '18', '19', '20', '21', '22'].map((d) => formatWeekday(date(`2026-11-${d}`))),
    ).toEqual(['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']);
  });
});

// formatLongDate now builds on formatWeekday; it had no direct test until spec 005b.
describe('formatLongDate', () => {
  it('"lunes 16 de noviembre", sin coma tras el día', () => {
    expect(formatLongDate(date('2026-11-16'))).toBe('lunes 16 de noviembre');
    expect(formatLongDate(date('2026-11-18'))).toBe('miércoles 18 de noviembre');
  });
});

describe('formatTrainedToday (spec 005b §6.1)', () => {
  it('AC-9: la sesión ya cerrada hoy y el día del plan al que pertenece', () => {
    expect(formatTrainedToday('Full body A', date('2026-11-20'))).toBe(
      'Ya entrenaste hoy (Full body A del viernes).',
    );
  });

  it('AC-10: un día del plan ya pasado, con acento', () => {
    expect(formatTrainedToday('Full body B', date('2026-11-18'))).toBe(
      'Ya entrenaste hoy (Full body B del miércoles).',
    );
    expect(formatTrainedToday('Torso A', date('2026-11-21'))).toBe(
      'Ya entrenaste hoy (Torso A del sábado).',
    );
  });
});

describe('formatSessionSummary', () => {
  it('AC-1, AC-6: ejercicios y minutos redondeados con RN-PLN-27', () => {
    expect(formatSessionSummary(7, 2880)).toBe('7 ejercicios · ~50 min');
    expect(formatSessionSummary(7, 3270)).toBe('7 ejercicios · ~55 min');
    expect(formatSessionSummary(7, 4485)).toBe('7 ejercicios · ~75 min');
  });

  it('un ejercicio, en singular; el mínimo de 5 min', () => {
    expect(formatSessionSummary(1, 60)).toBe('1 ejercicio · ~5 min');
  });
});

describe('formatItemsDone', () => {
  it('AC-16, AC-20, AC-21: "N de M ejercicios hechos"', () => {
    expect(formatItemsDone(1, 7)).toBe('1 de 7 ejercicios hechos');
    expect(formatItemsDone(7, 7)).toBe('7 de 7 ejercicios hechos');
    expect(formatItemsDone(0, 7)).toBe('0 de 7 ejercicios hechos');
  });

  it('con un solo ejercicio, en singular', () => {
    expect(formatItemsDone(0, 1)).toBe('0 de 1 ejercicio hecho');
  });
});

describe('formatRemaining', () => {
  it('AC-16, AC-21: "Faltan ~X min" con el redondeo de RN-PLN-27', () => {
    expect(formatRemaining(1605)).toBe('Faltan ~25 min');
    expect(formatRemaining(2280)).toBe('Faltan ~40 min');
    expect(formatRemaining(60)).toBe('Faltan ~5 min');
  });
});

describe('formatCurrent', () => {
  it('AC-16: "Vas en: <ejercicio> · serie N"', () => {
    expect(formatCurrent('Press de banca con barra', 2)).toBe(
      'Vas en: Press de banca con barra · serie 2',
    );
  });
});

describe('formatWeekSessions', () => {
  it('AC-10: "N de M sesiones"', () => {
    expect(formatWeekSessions(0, 3)).toBe('0 de 3 sesiones');
  });

  it('con una sola sesión, en singular', () => {
    expect(formatWeekSessions(0, 1)).toBe('0 de 1 sesión');
  });

  it('con cero, en plural', () => {
    expect(formatWeekSessions(0, 0)).toBe('0 de 0 sesiones');
  });
});

describe('formatElapsed', () => {
  it('AC-17: m:ss bajo una hora', () => {
    expect(formatElapsed(1122)).toBe('18:42');
    expect(formatElapsed(1123)).toBe('18:43');
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(59)).toBe('0:59');
    expect(formatElapsed(60)).toBe('1:00');
    expect(formatElapsed(3599)).toBe('59:59');
  });

  it('AC-17: h:mm:ss desde una hora, sin límite de horas', () => {
    expect(formatElapsed(3600)).toBe('1:00:00');
    expect(formatElapsed(3912)).toBe('1:05:12');
    expect(formatElapsed(90061)).toBe('25:01:01');
  });

  it('AC-17: descarta las fracciones de segundo', () => {
    expect(formatElapsed(5.9)).toBe('0:05');
    expect(formatElapsed(599.9)).toBe('9:59');
  });

  it('AC-17: un valor negativo (el reloj fue hacia atrás) es "0:00"', () => {
    expect(formatElapsed(-5)).toBe('0:00');
    expect(formatElapsed(-0.5)).toBe('0:00');
  });
});
