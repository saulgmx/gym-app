import { describe, expect, it } from 'vitest';
import { assessPain, checkPainInput } from '../domain/pain';
import type { RedFlag } from '../domain/types';

// RN-HLT-01, 02, 06, 07, 15 (contract v1.4, decision 6): pain input and its classification.
// Messages are written literally (spec §6.2, contract §6.1) so a typo in domain/messages.ts fails here.

const NORMAL = 'Molestia leve, dentro de lo normal. Sigue con el plan.';
const ATTENTION =
  'Molestia alta. Baja la carga la próxima sesión y evita los ejercicios que la provocaron.';
const ALERT =
  'Dolor alto. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta.';
const RED_FLAG = 'Consulta a un médico antes de seguir entrenando. No se sugerirá subir carga.';
const EMERGENCY = 'Acude a urgencias. No sigas entrenando hasta que te revise un médico.';

const unknownFlag = 'back_pain' as RedFlag;

function expectError(level: number, redFlags: RedFlag[], code: string, rule: RegExp) {
  const result = checkPainInput(level, redFlags);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
  expect(result.error.message).toMatch(rule);
  expect(result.error).not.toHaveProperty('details');
}

describe('checkPainInput', () => {
  it('RN-HLT-01: acepta los enteros de 0 a 10', () => {
    for (let level = 0; level <= 10; level++) {
      expect(checkPainInput(level, [])).toEqual({ ok: true, value: { level, redFlags: [] } });
    }
  });

  it.each([-1, 11, 2.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'RN-HLT-01: rechaza el nivel %s con health/pain-out-of-range',
    (level) => {
      expectError(level, [], 'health/pain-out-of-range', /RN-HLT-01/);
    },
  );

  it('RN-HLT-01: -0 se acepta y se normaliza a 0', () => {
    const result = checkPainInput(-0, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.is(result.value.level, 0)).toBe(true);
  });

  it('RN-HLT-01: con nivel y bandera inválidos a la vez, solo devuelve el error del nivel', () => {
    expectError(11, [unknownFlag], 'health/pain-out-of-range', /RN-HLT-01/);
  });

  it('RN-HLT-01: devuelve las banderas en el orden recibido, en un arreglo nuevo', () => {
    const redFlags: RedFlag[] = ['weakness', 'radiating', 'bladder_bowel', 'numbness'];
    const result = checkPainInput(4, redFlags);
    expect(result).toEqual({
      ok: true,
      value: { level: 4, redFlags: ['weakness', 'radiating', 'bladder_bowel', 'numbness'] },
    });
    if (!result.ok) return;
    expect(result.value.redFlags).not.toBe(redFlags);
  });

  it('RN-HLT-15: una bandera desconocida da health/invalid-red-flag', () => {
    expectError(2, [unknownFlag], 'health/invalid-red-flag', /RN-HLT-15/);
    expectError(2, ['numbness', unknownFlag], 'health/invalid-red-flag', /RN-HLT-15/);
  });

  it('RN-HLT-15: una bandera repetida da health/invalid-red-flag', () => {
    expectError(2, ['numbness', 'numbness'], 'health/invalid-red-flag', /RN-HLT-15/);
    expectError(2, ['numbness', 'weakness', 'numbness'], 'health/invalid-red-flag', /RN-HLT-15/);
  });
});

describe('assessPain', () => {
  it.each([
    [0, 'normal', NORMAL],
    [3, 'normal', NORMAL],
    [4, 'attention', ATTENTION],
    [6, 'attention', ATTENTION],
    [7, 'alert', ALERT],
    [10, 'alert', ALERT],
  ] as const)(
    'RN-HLT-02: el nivel %i es %s con el mensaje de su banda',
    (level, status, message) => {
      expect(assessPain(level, [])).toMatchObject({ status, message });
    },
  );

  it('RN-HLT-02: la banda no depende del umbral (assessPain no lo recibe)', () => {
    // With threshold 5 a 4 is still `attention`: the band is fixed, the threshold only drives RN-HLT-04.
    expect(assessPain.length).toBe(2);
    expect(assessPain(4, []).status).toBe('attention');
  });

  it('RN-HLT-02: una bandera roja no cambia la banda', () => {
    expect(assessPain(2, ['numbness'])).toMatchObject({ status: 'normal', message: NORMAL });
    expect(assessPain(5, ['weakness'])).toMatchObject({ status: 'attention', message: ATTENTION });
  });

  it.each(['radiating', 'numbness', 'weakness'] as const)(
    'RN-HLT-06: la bandera %s da el mensaje de consultar a un médico y bloquea la progresión',
    (flag) => {
      expect(assessPain(2, [flag])).toEqual({
        status: 'normal',
        message: NORMAL,
        redFlagMessage: RED_FLAG,
        blocksProgression: true,
      });
    },
  );

  it('RN-HLT-06: bladder_bowel da el mensaje de urgencias y bloquea la progresión', () => {
    expect(assessPain(0, ['bladder_bowel'])).toEqual({
      status: 'normal',
      message: NORMAL,
      redFlagMessage: EMERGENCY,
      blocksProgression: true,
    });
  });

  it('RN-HLT-06: bladder_bowel manda sobre otras banderas, en cualquier orden', () => {
    expect(assessPain(3, ['numbness', 'bladder_bowel']).redFlagMessage).toBe(EMERGENCY);
    expect(assessPain(3, ['bladder_bowel', 'radiating', 'weakness']).redFlagMessage).toBe(
      EMERGENCY,
    );
  });

  it('RN-HLT-06: sin banderas no existe la propiedad redFlagMessage', () => {
    for (const level of [0, 5, 9]) {
      expect(assessPain(level, [])).not.toHaveProperty('redFlagMessage');
    }
  });

  it.each([7, 10])('RN-HLT-07: el nivel %i sin banderas bloquea la progresión', (level) => {
    expect(assessPain(level, [])).toEqual({
      status: 'alert',
      message: ALERT,
      blocksProgression: true,
    });
  });

  it.each([0, 3, 4, 6])('RN-HLT-07: el nivel %i sin banderas no bloquea la progresión', (level) => {
    expect(assessPain(level, []).blocksProgression).toBe(false);
  });

  it('RN-HLT-07: alert con bandera también bloquea', () => {
    expect(assessPain(8, ['numbness'])).toEqual({
      status: 'alert',
      message: ALERT,
      redFlagMessage: RED_FLAG,
      blocksProgression: true,
    });
  });

  it.each([-1, 11, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'RN-HLT-01: con el nivel %s lanza un error que cita la regla',
    (level) => {
      expect(() => assessPain(level, [])).toThrow(/RN-HLT-01/);
    },
  );

  it('RN-HLT-15: con una bandera desconocida o repetida lanza un error que cita la regla', () => {
    expect(() => assessPain(2, [unknownFlag])).toThrow(/RN-HLT-15/);
    expect(() => assessPain(2, ['weakness', 'weakness'])).toThrow(/RN-HLT-15/);
  });

  it('RN-HLT-01: -0 se clasifica como 0', () => {
    expect(assessPain(-0, [])).toEqual({
      status: 'normal',
      message: NORMAL,
      blocksProgression: false,
    });
  });
});
