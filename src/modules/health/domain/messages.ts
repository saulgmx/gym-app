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
