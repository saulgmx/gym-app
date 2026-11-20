import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Instant, LocalDate } from '@/shared/kernel';
import { formatDateRangeLong, formatInstantLong, formatWeekdayDateLong } from '../format-date';
import { formatPreviewCounts, formatReplaceWarning } from '../pages/settings/format';

// Spec 007 §6.2 and §8 decision 14: the texts of the restore preview (AC-14, AC-16, AC-18).

const date = (s: string) => s as LocalDate;
const instant = (s: string) => s as Instant;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('formatInstantLong', () => {
  it('AC-14: "19 de noviembre de 2026, 22:30" en la hora del dispositivo (14 (a), (b))', () => {
    vi.stubEnv('TZ', 'America/Mexico_City');
    expect(formatInstantLong(instant('2026-11-19T22:30:00-06:00'))).toBe(
      '19 de noviembre de 2026, 22:30',
    );
    expect(formatInstantLong(instant('2026-11-20T04:30:00Z'))).toBe(
      '19 de noviembre de 2026, 22:30',
    );
  });

  it('14 (b): un respaldo hecho en otra zona se lee en la hora de este dispositivo', () => {
    vi.stubEnv('TZ', 'Europe/Madrid');
    expect(formatInstantLong(instant('2026-11-19T22:30:00-06:00'))).toBe(
      '20 de noviembre de 2026, 5:30',
    );
  });

  it('14 (a): la hora en 24 h sin cero inicial y los minutos con dos cifras', () => {
    vi.stubEnv('TZ', 'America/Mexico_City');
    expect(formatInstantLong(instant('2026-11-19T08:05:00-06:00'))).toBe(
      '19 de noviembre de 2026, 8:05',
    );
    expect(formatInstantLong(instant('2026-11-19T00:00:00-06:00'))).toBe(
      '19 de noviembre de 2026, 0:00',
    );
  });
});

describe('formatWeekdayDateLong', () => {
  it('AC-14: "lunes 16 de noviembre de 2026", en minúscula y sin depender de la zona', () => {
    vi.stubEnv('TZ', 'Pacific/Honolulu');
    expect(formatWeekdayDateLong(date('2026-11-16'))).toBe('lunes 16 de noviembre de 2026');
  });
});

describe('formatDateRangeLong', () => {
  it('AC-14: en el mismo mes, "Del 16 al 18 de noviembre de 2026"', () => {
    expect(formatDateRangeLong(date('2026-11-16'), date('2026-11-18'))).toBe(
      'Del 16 al 18 de noviembre de 2026',
    );
  });

  it('14 (d): entre meses, el año solo al final', () => {
    expect(formatDateRangeLong(date('2026-11-30'), date('2026-12-06'))).toBe(
      'Del 30 de noviembre al 6 de diciembre de 2026',
    );
  });

  it('14 (d): entre años, el año en las dos partes', () => {
    expect(formatDateRangeLong(date('2026-12-28'), date('2027-01-03'))).toBe(
      'Del 28 de diciembre de 2026 al 3 de enero de 2027',
    );
  });

  it('14 (d): el mismo mes de dos años distintos no se confunde con el mismo mes', () => {
    expect(formatDateRangeLong(date('2026-11-16'), date('2027-11-18'))).toBe(
      'Del 16 de noviembre de 2026 al 18 de noviembre de 2027',
    );
  });

  it('14 (c): un solo día, "El 16 de noviembre de 2026"', () => {
    expect(formatDateRangeLong(date('2026-11-16'), date('2026-11-16'))).toBe(
      'El 16 de noviembre de 2026',
    );
  });

  it('14 (b): no depende de la zona del dispositivo', () => {
    vi.stubEnv('TZ', 'Pacific/Honolulu');
    expect(formatDateRangeLong(date('2026-11-16'), date('2026-11-18'))).toBe(
      'Del 16 al 18 de noviembre de 2026',
    );
  });
});

describe('formatPreviewCounts', () => {
  it('AC-14: "2 sesiones · 15 series · 2 registros de dolor"', () => {
    expect(formatPreviewCounts({ completedWorkouts: 2, doneSets: 15, painEntries: 2 })).toBe(
      '2 sesiones · 15 series · 2 registros de dolor',
    );
  });

  it('14 (e): en singular con 1', () => {
    expect(formatPreviewCounts({ completedWorkouts: 1, doneSets: 1, painEntries: 1 })).toBe(
      '1 sesión · 1 serie · 1 registro de dolor',
    );
  });

  it('14 (e): en plural con 0', () => {
    expect(formatPreviewCounts({ completedWorkouts: 1, doneSets: 0, painEntries: 0 })).toBe(
      '1 sesión · 0 series · 0 registros de dolor',
    );
  });

  it('AC-16: sin sesiones guardadas, solo "Sin sesiones guardadas"', () => {
    expect(formatPreviewCounts({ completedWorkouts: 0, doneSets: 0, painEntries: 0 })).toBe(
      'Sin sesiones guardadas',
    );
  });
});

describe('formatReplaceWarning', () => {
  it('AC-14: con sesiones en el dispositivo, cuántas se reemplazan', () => {
    expect(formatReplaceWarning(3)).toBe(
      'Se reemplazarán todos los datos de este dispositivo: 3 sesiones guardadas, el plan y el dolor lumbar. No se puede deshacer.',
    );
  });

  it('14 (f): "1 sesión guardada" en singular', () => {
    expect(formatReplaceWarning(1)).toBe(
      'Se reemplazarán todos los datos de este dispositivo: 1 sesión guardada, el plan y el dolor lumbar. No se puede deshacer.',
    );
  });

  it('AC-18: sin sesiones en el dispositivo', () => {
    expect(formatReplaceWarning(0)).toBe(
      'Se reemplazarán el plan y los datos de este dispositivo. No se puede deshacer.',
    );
  });
});
