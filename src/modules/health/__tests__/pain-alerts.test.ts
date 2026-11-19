import { describe, expect, it } from 'vitest';
import { noticeOf, persistentAlert } from '../domain/pain';
import type { RedFlag } from '../domain/types';

// RN-HLT-03, 04, 05, 08, 12, 13 (contract v1.5, decision 7): persistent alert and the "Hoy" notice.
// Lists are latest first (`latestFirst`), as the service passes them (RN-HLT-14). Threshold 3 unless
// stated. Texts are written literally (contract §6.1) so a typo in domain/messages.ts fails here.

const T = 3;

interface Entry {
  level: number;
  redFlags: RedFlag[];
}

const e = (level: number, ...redFlags: RedFlag[]): Entry => ({ level, redFlags });
const levels = (...values: number[]): Entry[] => values.map((level) => e(level));

const BLADDER_TEXT =
  'En la última sesión marcaste problemas de control de vejiga o intestino. Acude a urgencias antes de volver a entrenar.';
const RED_FLAG_TEXT =
  'En la última sesión marcaste una señal de alarma. Consulta a un médico antes de seguir entrenando.';
const alertText = (n: number) =>
  `Espalda baja ${String(n)}/10 en la última sesión. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta.`;
const overText = (u: number) =>
  `Espalda baja por encima de ${String(u)}/10 en las 2 últimas sesiones. Hoy prioriza la técnica y no añadas carga; si sigue, consulta a tu traumatólogo o fisioterapeuta.`;
const risingText = (seq: string) =>
  `Tu dolor lumbar subió en las 3 últimas sesiones (${seq}). Hoy prioriza la técnica y no añadas carga.`;
const attentionText = (n: number) =>
  `Espalda baja ${String(n)}/10 en la última sesión. Hoy baja la carga y evita los ejercicios que la provocaron.`;

describe('persistentAlert', () => {
  it('RN-HLT-08: sin entradas no hay alerta', () => {
    expect(persistentAlert([], T)).toBeNull();
  });

  it('RN-HLT-04: las 2 últimas sobre el umbral dan over_threshold_2x', () => {
    expect(persistentAlert(levels(4, 4), T)).toEqual({ reason: 'over_threshold_2x' });
    expect(persistentAlert(levels(10, 7), T)).toEqual({ reason: 'over_threshold_2x' });
  });

  it('RN-HLT-04: si una de las 2 últimas no supera el umbral, no hay alerta', () => {
    expect(persistentAlert(levels(4, 3), T)).toBeNull();
    expect(persistentAlert(levels(3, 4), T)).toBeNull();
  });

  it('RN-HLT-04: con una sola entrada no se cumple', () => {
    expect(persistentAlert(levels(4), T)).toBeNull();
    expect(persistentAlert(levels(9), T)).toBeNull();
  });

  it('RN-HLT-04: solo cuentan las 2 primeras', () => {
    expect(persistentAlert(levels(4, 4, 0), T)).toEqual({ reason: 'over_threshold_2x' });
    expect(persistentAlert(levels(2, 4, 4), T)).toBeNull();
  });

  it('RN-HLT-03: superar es estrictamente mayor que el umbral', () => {
    expect(persistentAlert(levels(3, 3), T)).toBeNull();
  });

  it('RN-HLT-03: usa el umbral que recibe', () => {
    expect(persistentAlert(levels(4, 4), 4)).toBeNull();
    expect(persistentAlert(levels(3, 3), 2)).toEqual({ reason: 'over_threshold_2x' });
  });

  it('RN-HLT-05: 3 últimas estrictamente crecientes dan rising_3x (cronológico 1 → 2 → 3)', () => {
    expect(persistentAlert(levels(3, 2, 1), T)).toEqual({ reason: 'rising_3x' });
    expect(persistentAlert(levels(2, 1, 0), T)).toEqual({ reason: 'rising_3x' });
  });

  it('RN-HLT-05: creciente no estricto o plano no cuenta', () => {
    expect(persistentAlert(levels(2, 2, 1), T)).toBeNull();
    expect(persistentAlert(levels(2, 1, 1), T)).toBeNull();
    expect(persistentAlert(levels(0, 0, 0), T)).toBeNull();
  });

  it('RN-HLT-05: decreciente no cuenta', () => {
    expect(persistentAlert(levels(1, 2, 3), T)).toBeNull();
  });

  it('RN-HLT-05: con menos de 3 entradas no se cumple', () => {
    expect(persistentAlert(levels(3, 2), T)).toBeNull();
  });

  it('RN-HLT-05: solo cuentan las 3 primeras', () => {
    expect(persistentAlert(levels(3, 2, 1, 9), T)).toEqual({ reason: 'rising_3x' });
    expect(persistentAlert(levels(1, 3, 2, 1), T)).toBeNull();
  });

  it('RN-HLT-08: banderas en la última dan red_flag', () => {
    expect(persistentAlert([e(2, 'numbness')], T)).toEqual({ reason: 'red_flag' });
    expect(persistentAlert([e(0, 'bladder_bowel')], T)).toEqual({ reason: 'red_flag' });
  });

  it('RN-HLT-08: red_flag manda sobre over_threshold_2x y rising_3x', () => {
    expect(persistentAlert([e(2, 'numbness'), e(4), e(4)], T)).toEqual({ reason: 'red_flag' });
    expect(persistentAlert([e(5, 'numbness'), e(4)], T)).toEqual({ reason: 'red_flag' });
    expect(persistentAlert([e(3, 'weakness'), e(2), e(1)], T)).toEqual({ reason: 'red_flag' });
  });

  it('RN-HLT-08: over_threshold_2x manda sobre rising_3x', () => {
    expect(persistentAlert(levels(6, 5, 4), T)).toEqual({ reason: 'over_threshold_2x' });
  });

  it('RN-HLT-08: una bandera que no es de la última no mantiene la alerta', () => {
    expect(persistentAlert([e(2), e(4, 'numbness')], T)).toBeNull();
  });

  it('RN-HLT-08: tras [4, 4] una entrada 2 quita la alerta (es derivada)', () => {
    expect(persistentAlert(levels(2, 4, 4), T)).toBeNull();
  });

  it('RN-HLT-08: no modifica el arreglo de entrada', () => {
    const input = Object.freeze([Object.freeze(e(3)), Object.freeze(e(2)), Object.freeze(e(1))]);
    expect(persistentAlert(input, T)).toEqual({ reason: 'rising_3x' });
    expect(input.map((x) => x.level)).toEqual([3, 2, 1]);
  });
});

describe('noticeOf', () => {
  it('RN-HLT-12: sin entradas no hay aviso (AC-37)', () => {
    expect(noticeOf([], T)).toBeNull();
  });

  it('RN-HLT-12: última en normal, sin banderas ni alerta persistente → sin aviso (AC-38)', () => {
    expect(noticeOf(levels(3), T)).toBeNull();
    expect(noticeOf(levels(0), T)).toBeNull();
    expect(noticeOf(levels(3, 5), T)).toBeNull();
  });

  it('RN-HLT-12: última en attention → aviso attention con N (AC-39)', () => {
    expect(noticeOf(levels(5), T)).toEqual({ cause: 'attention', message: attentionText(5) });
    expect(noticeOf(levels(4), T)).toEqual({ cause: 'attention', message: attentionText(4) });
    expect(noticeOf(levels(6, 2), T)).toEqual({ cause: 'attention', message: attentionText(6) });
  });

  it('RN-HLT-12: última en alert → aviso alert con N (AC-42)', () => {
    expect(noticeOf(levels(8), T)).toEqual({ cause: 'alert', message: alertText(8) });
    expect(noticeOf(levels(7), T)).toEqual({ cause: 'alert', message: alertText(7) });
  });

  it('RN-HLT-12: última 2 con numbness → aviso red_flag', () => {
    expect(noticeOf([e(2, 'numbness')], T)).toEqual({ cause: 'red_flag', message: RED_FLAG_TEXT });
  });

  it('RN-HLT-12: bladder_bowel en la última → aviso de urgencias (AC-43)', () => {
    expect(noticeOf([e(1, 'bladder_bowel')], T)).toEqual({
      cause: 'bladder_bowel',
      message: BLADDER_TEXT,
    });
  });

  it('RN-HLT-12: weakness en la última → aviso red_flag (AC-43)', () => {
    expect(noticeOf([e(3, 'weakness')], T)).toEqual({ cause: 'red_flag', message: RED_FLAG_TEXT });
  });

  it('RN-HLT-12: rising_3x da aviso aunque la última sea normal (AC-40)', () => {
    expect(noticeOf(levels(3, 2, 1), T)).toEqual({
      cause: 'rising_3x',
      message: risingText('1 → 2 → 3'),
    });
  });

  it('RN-HLT-12: over_threshold_2x con U (AC-41)', () => {
    expect(noticeOf(levels(5, 4), T)).toEqual({
      cause: 'over_threshold_2x',
      message: overText(3),
    });
  });

  it('RN-HLT-12: el texto de over_threshold_2x usa el umbral recibido', () => {
    expect(noticeOf(levels(6, 5), 4)).toEqual({
      cause: 'over_threshold_2x',
      message: overText(4),
    });
  });

  it('RN-HLT-08: tras [5, 4] una entrada 2 quita el aviso (AC-45)', () => {
    expect(noticeOf(levels(2, 5, 4), T)).toBeNull();
  });

  it('RN-HLT-13: bladder_bowel manda sobre otra bandera, en cualquier orden', () => {
    expect(noticeOf([e(2, 'numbness', 'bladder_bowel')], T)?.cause).toBe('bladder_bowel');
    expect(noticeOf([e(2, 'bladder_bowel', 'weakness')], T)?.cause).toBe('bladder_bowel');
  });

  it('RN-HLT-13: bandera roja manda sobre alert', () => {
    expect(noticeOf([e(8, 'numbness')], T)).toEqual({ cause: 'red_flag', message: RED_FLAG_TEXT });
  });

  it('RN-HLT-13: bladder_bowel manda sobre alert y over_threshold_2x', () => {
    expect(noticeOf([e(9, 'bladder_bowel'), e(8)], T)?.cause).toBe('bladder_bowel');
  });

  it('RN-HLT-13: alert manda sobre over_threshold_2x', () => {
    expect(noticeOf(levels(8, 5), T)).toEqual({ cause: 'alert', message: alertText(8) });
  });

  it('RN-HLT-13: over_threshold_2x manda sobre rising_3x y attention', () => {
    expect(noticeOf(levels(5, 4), T)?.cause).toBe('over_threshold_2x');
    expect(noticeOf(levels(6, 5, 4), T)?.cause).toBe('over_threshold_2x');
  });

  it('RN-HLT-13: rising_3x manda sobre attention (cronológico 1 → 2 → 5)', () => {
    expect(noticeOf(levels(5, 2, 1), T)).toEqual({
      cause: 'rising_3x',
      message: risingText('1 → 2 → 5'),
    });
  });

  it('RN-HLT-13: la secuencia de rising_3x va en orden cronológico', () => {
    expect(noticeOf(levels(6, 3, 1), T)?.message).toBe(risingText('1 → 3 → 6'));
  });

  it('RN-HLT-05: la secuencia de rising_3x solo lleva las 3 últimas', () => {
    expect(noticeOf(levels(3, 2, 1, 0), T)?.message).toBe(risingText('1 → 2 → 3'));
  });

  it('RN-HLT-12: no modifica el arreglo de entrada', () => {
    const flagged = Object.freeze([Object.freeze(e(5, 'numbness')), Object.freeze(e(4))]);
    expect(noticeOf(flagged, T)?.cause).toBe('red_flag');
    expect(flagged.map((x) => x.level)).toEqual([5, 4]);

    const rising = Object.freeze([Object.freeze(e(3)), Object.freeze(e(2)), Object.freeze(e(1))]);
    expect(noticeOf(rising, T)?.message).toBe(risingText('1 → 2 → 3'));
    expect(rising.map((x) => x.level)).toEqual([3, 2, 1]);
  });
});
