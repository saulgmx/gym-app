import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemClock } from '@/shared/kernel';

// Node re-reads the TZ variable on assignment, so each test can pick a zone.
describe('systemClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('now() usa el offset local y today() el día local (México, -06:00)', () => {
    vi.stubEnv('TZ', 'America/Mexico_City');
    vi.setSystemTime(new Date('2026-11-17T04:30:05Z'));
    expect(systemClock.now()).toBe('2026-11-16T22:30:05-06:00');
    expect(systemClock.today()).toBe('2026-11-16');
  });

  it('formatea offsets positivos con minutos (India, +05:30)', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata');
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(systemClock.now()).toBe('2026-01-01T05:30:00+05:30');
    expect(systemClock.today()).toBe('2026-01-01');
  });

  it('now() se puede volver a leer como el mismo momento', () => {
    vi.stubEnv('TZ', 'America/Mexico_City');
    const t = new Date('2026-06-15T12:00:00Z');
    vi.setSystemTime(t);
    expect(Date.parse(systemClock.now())).toBe(t.getTime());
  });
});
