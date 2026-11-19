import type { PainStatus } from './types';

// Health texts (spec §6.2, docs/modules/health.md §6.1). They are rules, not errors, so they do not
// go through the ADR-0010 message map. The red flag texts stay [PROPUESTO] until the specialist
// validates them (spec 005 T24).

export const BAND_MESSAGES: Readonly<Record<PainStatus, string>> = {
  normal: 'Molestia leve, dentro de lo normal. Sigue con el plan.',
  attention:
    'Molestia alta. Baja la carga la próxima sesión y evita los ejercicios que la provocaron.',
  alert:
    'Dolor alto. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta.',
};

export const RED_FLAG_MESSAGE =
  'Consulta a un médico antes de seguir entrenando. No se sugerirá subir carga.';

export const EMERGENCY_MESSAGE =
  'Acude a urgencias. No sigas entrenando hasta que te revise un médico.';

// "Hoy" notice, one text per cause (RN-HLT-13). n = latest level, u = threshold, both integers;
// `chronological` = the 3 levels from oldest to latest.
export const NOTICE_MESSAGES = {
  bladder_bowel:
    'En la última sesión marcaste problemas de control de vejiga o intestino. Acude a urgencias antes de volver a entrenar.',
  red_flag:
    'En la última sesión marcaste una señal de alarma. Consulta a un médico antes de seguir entrenando.',
  alert: (n: number) =>
    `Espalda baja ${String(n)}/10 en la última sesión. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta.`,
  over_threshold_2x: (u: number) =>
    `Espalda baja por encima de ${String(u)}/10 en las 2 últimas sesiones. Hoy prioriza la técnica y no añadas carga; si sigue, consulta a tu traumatólogo o fisioterapeuta.`,
  rising_3x: (chronological: readonly number[]) =>
    `Tu dolor lumbar subió en las 3 últimas sesiones (${chronological.join(' → ')}). Hoy prioriza la técnica y no añadas carga.`,
  attention: (n: number) =>
    `Espalda baja ${String(n)}/10 en la última sesión. Hoy baja la carga y evita los ejercicios que la provocaron.`,
} as const;
