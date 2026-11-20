import { describe, expect, it } from 'vitest';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { checkHealthBackup, describeHealthBackup } from '../domain/backup';
import type { HealthBackup, PainEntry } from '../domain/types';

// RN-HLT-21 (contract v1.14, decision 16), tests first (P-5): the health backup's own rules and
// its description. Spec 007 §4: L16 with level 2 and M18 with level 5 and one red flag.

const id = (s: string) => s as ID;

const entry = (n: string, workoutId: string, overrides: Partial<PainEntry> = {}): PainEntry => ({
  id: id(`pain-${n}`),
  workoutId: id(workoutId),
  date: '2026-11-16' as LocalDate,
  recordedAt: '2026-11-16T18:53:00-06:00' as Instant,
  level: 2,
  redFlags: [],
  ...overrides,
});

const spec = (): HealthBackup => ({
  painEntries: [
    entry('1', 'L16'),
    entry('2', 'M18', {
      date: '2026-11-18' as LocalDate,
      level: 5,
      redFlags: ['numbness'],
    }),
  ],
});

function failure(data: HealthBackup) {
  const result = checkHealthBackup(data);
  if (result.ok) throw new Error('expected a failure');
  return result.error;
}

describe('checkHealthBackup', () => {
  it('RN-HLT-21: el respaldo de la spec §4 es válido; uno vacío también', () => {
    expect(checkHealthBackup(spec())).toEqual({ ok: true, value: undefined });
    expect(checkHealthBackup({ painEntries: [] }).ok).toBe(true);
  });

  it('RN-HLT-21 (b): dos entradas con el mismo id → unique-id con el id', () => {
    const data = spec();
    data.painEntries.push(entry('1', 'X99'));
    const error = failure(data);
    expect(error.code).toBe('health/invalid-backup');
    expect(error.details).toEqual({ rule: 'unique-id', id: 'pain-1' });
    expect(error.message).toMatch(/RN-HLT-21/);
  });

  it('RN-HLT-09: dos entradas del mismo workout → one-per-workout con el workout', () => {
    const data = spec();
    data.painEntries.push(entry('3', 'M18', { level: 7 }));
    expect(failure(data).details).toEqual({ rule: 'one-per-workout', workoutId: 'M18' });
  });

  it('RN-HLT-21 (b): con las dos rotas sale unique-id', () => {
    const data = spec();
    data.painEntries.push(entry('3', 'M18'), entry('1', 'X99'));
    expect(failure(data).details).toMatchObject({ rule: 'unique-id' });
  });

  it('RN-HLT-21 (c): no compara date con nada (no ve los workouts)', () => {
    const data = spec();
    data.painEntries.push(entry('3', 'W20', { date: '2030-01-01' as LocalDate }));
    expect(checkHealthBackup(data).ok).toBe(true);
  });
});

describe('describeHealthBackup', () => {
  it('RN-HLT-21 (d): requiere los workouts en el orden de las entradas, cuenta las entradas y no ofrece nada', () => {
    const data = spec();
    data.painEntries.reverse();
    expect(describeHealthBackup(data)).toEqual({
      facts: { painEntries: 2 },
      provides: {},
      requires: { workout: ['M18', 'L16'] },
    });
  });

  it('RN-HLT-21 (d): sin entradas → 0 y una lista vacía', () => {
    expect(describeHealthBackup({ painEntries: [] })).toEqual({
      facts: { painEntries: 0 },
      provides: {},
      requires: { workout: [] },
    });
  });
});
