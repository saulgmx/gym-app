import { describe, expect, it } from 'vitest';
import type { Instant, LocalDate, SeriesRow } from '@/shared/kernel';
import { CSV_VERSION, csvFilename, seriesCsv } from '../domain/csv';

// RN-DAT-14 (spec 008, contract v1.7 §4 "Detalle del CSV"): the text of the series CSV.

const BOM = '﻿';
const CRLF = '\r\n';

// The format of version 1. Changing this line changes the format: bump CSV_VERSION (ADR-0013).
const HEADER = 'date,week,session,exercise,metric,setNumber,weightKg,reps,rir,isExtra,completedAt';

// The 2nd set of Prensa de piernas of L16 (spec 008 AC-12).
const row = (overrides: Partial<SeriesRow> = {}): SeriesRow => ({
  date: '2026-11-16' as LocalDate,
  week: 1,
  session: 'Full body A',
  exercise: 'Prensa de piernas',
  metric: 'weight',
  setNumber: 2,
  weightKg: 100,
  reps: 9,
  rir: 2,
  isExtra: false,
  completedAt: '2026-11-16T18:06:00-06:00' as Instant,
  ...overrides,
});

/** The data lines, without BOM, header or the empty string after the last CRLF. */
const lines = (csv: string) => csv.split(CRLF).slice(1, -1);
const onlyLine = (r: SeriesRow) => {
  const [line, ...rest] = lines(seriesCsv([r]));
  expect(rest).toEqual([]);
  return line;
};
// Only for lines without quoted fields.
const field = (r: SeriesRow, column: keyof SeriesRow) =>
  onlyLine(r)?.split(',')[HEADER.split(',').indexOf(column)];

describe('seriesCsv', () => {
  it('RN-DAT-14, AC-8: empieza con el BOM, que en UTF-8 son los bytes EF BB BF', () => {
    const csv = seriesCsv([row()]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect([...new TextEncoder().encode(csv).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.indexOf(BOM, 1)).toBe(-1);
  });

  it('RN-DAT-14, AC-9: la primera línea son los encabezados en inglés, en su orden', () => {
    expect(seriesCsv([row()]).slice(BOM.length).split(CRLF)[0]).toBe(HEADER);
  });

  it('RN-DAT-14, AC-8: cada línea termina en CRLF, también la última, y no hay LF ni CR sueltos', () => {
    const csv = seriesCsv([row(), row({ setNumber: 3 })]);
    expect(csv.endsWith(CRLF)).toBe(true);
    expect(csv.endsWith(CRLF + CRLF)).toBe(false);
    const withoutCrlf = csv.split(CRLF).join('');
    expect(withoutCrlf).not.toMatch(/[\r\n]/);
    expect(csv.split(CRLF)).toHaveLength(4); // header, 2 rows and '' after the last CRLF
  });

  it('RN-DAT-14, AC-12: la fila de la 2.ª de Prensa de piernas', () => {
    expect(onlyLine(row())).toBe(
      '2026-11-16,1,Full body A,Prensa de piernas,weight,2,100,9,2,false,2026-11-16T18:06:00-06:00',
    );
  });

  it('RN-DAT-14, AC-16: Dead bug con weightKg vacío', () => {
    expect(
      onlyLine(
        row({
          exercise: 'Dead bug',
          metric: 'reps',
          setNumber: 1,
          weightKg: null,
          reps: 12,
          rir: 1,
          completedAt: '2026-11-16T18:47:00-06:00' as Instant,
        }),
      ),
    ).toBe('2026-11-16,1,Full body A,Dead bug,reps,1,,12,1,false,2026-11-16T18:47:00-06:00');
  });

  it('RN-DAT-14, AC-18: números con punto decimal y sin ceros de más', () => {
    expect(field(row({ weightKg: 62.5 }), 'weightKg')).toBe('62.5');
    expect(field(row({ weightKg: 100 }), 'weightKg')).toBe('100');
    expect(field(row({ weightKg: 1.25 }), 'weightKg')).toBe('1.25');
  });

  it('RN-DAT-14, AC-14, AC-15: la asistencia lleva su signo, el peso 0 es 0 y -0 también es 0', () => {
    expect(field(row({ weightKg: -20 }), 'weightKg')).toBe('-20');
    expect(field(row({ weightKg: 0 }), 'weightKg')).toBe('0');
    expect(field(row({ weightKg: -0 }), 'weightKg')).toBe('0');
  });

  it('RN-DAT-14, AC-17, AC-19, AC-20: null sale vacío, también en la última columna', () => {
    expect(
      onlyLine(
        row({
          date: '2026-11-25' as LocalDate,
          week: null,
          session: 'Sesión libre',
          exercise: 'Plancha',
          metric: 'time',
          setNumber: 1,
          weightKg: null,
          reps: 40,
          rir: null,
          completedAt: null,
        }),
      ),
    ).toBe('2026-11-25,,Sesión libre,Plancha,time,1,,40,,false,');
  });

  it('RN-DAT-14, AC-15: isExtra sale como true o false', () => {
    expect(field(row({ isExtra: true }), 'isExtra')).toBe('true');
    expect(field(row({ isExtra: false }), 'isExtra')).toBe('false');
  });

  it('RN-DAT-14, AC-21: con coma y comillas va entre comillas y la comilla se duplica', () => {
    expect(onlyLine(row({ exercise: 'Remo "Pendlay", banco' }))).toBe(
      '2026-11-16,1,Full body A,"Remo ""Pendlay"", banco",weight,2,100,9,2,false,2026-11-16T18:06:00-06:00',
    );
  });

  it('RN-DAT-14: entre comillas si lleva coma, comilla, CR o LF, cada uno por separado', () => {
    const exerciseField = (exercise: string) =>
      seriesCsv([row({ exercise })])
        .slice(BOM.length + HEADER.length + CRLF.length)
        .split(',Full body A,')[1]
        ?.split(',weight,')[0];
    expect(exerciseField('Remo, banco')).toBe('"Remo, banco"');
    expect(exerciseField('Remo "Pendlay"')).toBe('"Remo ""Pendlay"""');
    expect(exerciseField('Remo\nbanco')).toBe('"Remo\nbanco"');
    expect(exerciseField('Remo\rbanco')).toBe('"Remo\rbanco"');
  });

  it('RN-DAT-14: sin coma, comilla, CR ni LF el texto va tal cual, con acentos y espacios', () => {
    expect(field(row({ exercise: 'Jalón al pecho' }), 'exercise')).toBe('Jalón al pecho');
    expect(field(row({ session: 'Sesión libre' }), 'session')).toBe('Sesión libre');
  });

  it('RN-DAT-14: las comillas aplican también a session', () => {
    expect(onlyLine(row({ session: 'Full body A, versión 2' }))).toBe(
      '2026-11-16,1,"Full body A, versión 2",Prensa de piernas,weight,2,100,9,2,false,2026-11-16T18:06:00-06:00',
    );
  });

  it('spec 008 decisión 7: un texto que empieza con =, +, - o @ no se toca', () => {
    expect(field(row({ exercise: '=1+1' }), 'exercise')).toBe('=1+1');
    expect(field(row({ exercise: '+remo' }), 'exercise')).toBe('+remo');
    expect(field(row({ exercise: '-remo' }), 'exercise')).toBe('-remo');
    expect(field(row({ exercise: '@remo' }), 'exercise')).toBe('@remo');
  });

  it('RN-DAT-14: las filas salen en el orden en que llegan (el puerto ya las ordenó)', () => {
    const csv = seriesCsv([row({ setNumber: 3 }), row({ setNumber: 1 })]);
    expect(lines(csv).map((l) => l.split(',')[5])).toEqual(['3', '1']);
  });

  it('RN-DAT-14, AC-23: sin filas, solo el BOM y los encabezados con su CRLF', () => {
    expect(seriesCsv([])).toBe(BOM + HEADER + CRLF);
  });
});

describe('csvFilename', () => {
  it('RN-DAT-14, AC-2, ADR-0013: lleva la versión del formato y la fecha de hoy', () => {
    expect(CSV_VERSION).toBe(1);
    expect(csvFilename('2026-11-25' as LocalDate)).toBe('gym-series-v1-2026-11-25.csv');
  });
});
