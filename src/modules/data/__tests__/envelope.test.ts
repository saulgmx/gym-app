import { describe, expect, it } from 'vitest';
import { checkModules, checkVersions } from '../domain/envelope';
import type { Envelope, PortInfo } from '../domain/types';
import { parseEnvelope } from '../infrastructure/envelope-schema';

// RN-DAT-02, steps 2 to 4 (contract v1.3, §6 "Detalle de la revisión"): envelope, versions, modules.

const PORTS: PortInfo[] = [
  { name: 'plan', version: 1 },
  { name: 'training', version: 1 },
  { name: 'health', version: 1 },
];

const base = () => ({
  app: 'gym-app',
  schemaVersion: 1,
  exportedAt: '2026-11-19T22:30:00-06:00',
  modules: {
    plan: { version: 1, data: { exercises: [] } },
    training: { version: 1, data: { workouts: [], sets: [] } },
    health: { version: 1, data: { painEntries: [] } },
  },
});

const text = (value: unknown) => JSON.stringify(value);

function envelope(patch: Partial<Envelope> = {}): Envelope {
  const parsed = parseEnvelope(text(base()));
  if (!parsed.ok) throw new Error('fixture must parse');
  return { ...parsed.value, ...patch };
}

const without = (modules: Envelope['modules'], name: string): Envelope['modules'] =>
  Object.fromEntries(Object.entries(modules).filter(([key]) => key !== name));

describe('parseEnvelope (paso 2)', () => {
  it('RN-DAT-02: un respaldo bien formado devuelve versión, fecha y módulos tal cual', () => {
    const result = parseEnvelope(text(base()));
    expect(result).toEqual({
      ok: true,
      value: {
        schemaVersion: 1,
        exportedAt: '2026-11-19T22:30:00-06:00',
        modules: base().modules,
      },
    });
  });

  it('RN-DAT-02: los datos de cada módulo no se validan aquí (los valida su puerto)', () => {
    const value = { ...base(), modules: { ...base().modules, plan: { version: 1, data: 'x' } } };
    expect(parseEnvelope(text(value)).ok).toBe(true);
  });

  it.each([
    ['texto que no es JSON', '{ "app": "gym-app",'],
    ['JSON que no es un objeto', '[1, 2]'],
    ['JSON nulo', 'null'],
    ['app de otra aplicación', text({ ...base(), app: 'otra-app' })],
    ['sin app', text({ ...base(), app: undefined })],
    ['clave de más en el sobre', text({ ...base(), extra: true })],
    ['sin schemaVersion', text({ ...base(), schemaVersion: undefined })],
    ['schemaVersion 0', text({ ...base(), schemaVersion: 0 })],
    ['schemaVersion decimal', text({ ...base(), schemaVersion: 1.5 })],
    ['schemaVersion como texto', text({ ...base(), schemaVersion: '1' })],
    ['exportedAt sin offset', text({ ...base(), exportedAt: '2026-11-19T22:30:00' })],
    ['sin exportedAt', text({ ...base(), exportedAt: undefined })],
    ['modules que no es un objeto', text({ ...base(), modules: [] })],
    ['módulo sin version', text({ ...base(), modules: { plan: { data: {} } } })],
    ['módulo con version 0', text({ ...base(), modules: { plan: { version: 0, data: {} } } })],
    [
      'módulo con clave de más',
      text({ ...base(), modules: { plan: { version: 1, data: {}, x: 1 } } }),
    ],
  ])('RN-DAT-02: %s → data/not-gym-app-file', (_, input) => {
    const result = parseEnvelope(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('data/not-gym-app-file');
    expect(result.error.message).toMatch(/RN-DAT-02/);
  });

  it('RN-DAT-02: un sobre válido con schemaVersion 2 pasa el paso 2 (lo rechaza el 3)', () => {
    expect(parseEnvelope(text({ ...base(), schemaVersion: 2 })).ok).toBe(true);
  });

  it('RN-DAT-02: con app distinto y módulos que faltan, el error es el del paso 2', () => {
    const result = parseEnvelope(text({ ...base(), app: 'otra-app', modules: {} }));
    expect(!result.ok && result.error.code).toBe('data/not-gym-app-file');
  });
});

describe('checkVersions (paso 3)', () => {
  it('RN-DAT-02: versiones iguales a las actuales → ok', () => {
    expect(checkVersions(envelope(), PORTS)).toEqual({ ok: true, value: undefined });
  });

  it('RN-DAT-02: versiones anteriores → ok (las migra cada puerto)', () => {
    const ports = PORTS.map((p) => ({ ...p, version: 3 }));
    expect(checkVersions(envelope(), ports).ok).toBe(true);
  });

  it('RN-DAT-02: schemaVersion 2 → data/unsupported-version con module null', () => {
    const result = checkVersions(envelope({ schemaVersion: 2 }), PORTS);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'data/unsupported-version',
        details: { module: null, version: 2, supported: 1 },
      }) as unknown,
    });
  });

  it('RN-DAT-02: un módulo registrado con versión mayor → data/unsupported-version con su nombre', () => {
    const e = envelope();
    const modules = { ...e.modules, training: { version: 2, data: {} } };
    const result = checkVersions({ ...e, modules }, PORTS);
    expect(!result.ok && result.error.details).toEqual({
      module: 'training',
      version: 2,
      supported: 1,
    });
  });

  it('RN-DAT-02: un módulo no registrado no se mira aquí, aunque tenga versión mayor', () => {
    const e = envelope();
    const modules = { ...e.modules, progression: { version: 9, data: {} } };
    expect(checkVersions({ ...e, modules }, PORTS).ok).toBe(true);
  });

  it('RN-DAT-02: un módulo registrado que falta no se mira aquí (lo atrapa el paso 4)', () => {
    const e = envelope();
    expect(checkVersions({ ...e, modules: without(e.modules, 'health') }, PORTS).ok).toBe(true);
  });

  it('RN-DAT-02: el mensaje cita la regla', () => {
    const result = checkVersions(envelope({ schemaVersion: 2 }), PORTS);
    expect(!result.ok && result.error.message).toMatch(/RN-DAT-02/);
  });
});

describe('checkModules (paso 4)', () => {
  it('RN-DAT-02: exactamente los módulos registrados → ok, en cualquier orden', () => {
    const e = envelope();
    const { plan, training, health } = e.modules;
    const reordered = { ...e, modules: { health, plan, training } } as Envelope;
    expect(checkModules(reordered, PORTS)).toEqual({ ok: true, value: undefined });
  });

  it('RN-DAT-02: falta uno y sobra otro → module-mismatch con missing y unexpected', () => {
    const e = envelope();
    const modules = {
      ...without(e.modules, 'training'),
      progression: { version: 1, data: {} },
      app: { version: 1, data: {} },
    };
    const result = checkModules({ ...e, modules }, PORTS);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'data/invalid-module-data',
        details: {
          module: null,
          cause: 'data/module-mismatch',
          details: { missing: ['training'], unexpected: ['progression', 'app'] },
        },
      }) as unknown,
    });
  });

  it('RN-DAT-02: faltan varios → en orden de puertos', () => {
    const e = envelope({ modules: {} });
    const result = checkModules(e, PORTS);
    expect(!result.ok && result.error.details).toEqual({
      module: null,
      cause: 'data/module-mismatch',
      details: { missing: ['plan', 'training', 'health'], unexpected: [] },
    });
  });

  it('RN-DAT-02: el mensaje cita la regla', () => {
    const result = checkModules(envelope({ modules: {} }), PORTS);
    expect(!result.ok && result.error.message).toMatch(/RN-DAT-02/);
  });
});
