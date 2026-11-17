import type { PlanErrorCode } from '@/modules/plan';

// User-facing error texts (ADR-0010). Only app maps error codes to Spanish messages.

/** Generic text for unexpected errors (spec 000 §6). */
export const GENERIC_ERROR_MESSAGE =
  'Algo salió mal. Tus datos guardados no se han perdido. Recarga la app para continuar.';

/** Union of every module's error codes. */
export type ErrorCode = PlanErrorCode;

/** Adding a code to ErrorCode without its message here breaks tsc. */
export const errorMessages: Record<ErrorCode, string> = {
  // Phase 1: none of these is a user mistake, so all use the generic text (spec 001 plan §6.8).
  'plan/invalid-seed': GENERIC_ERROR_MESSAGE,
  'plan/high-risk-exercise': GENERIC_ERROR_MESSAGE,
  'plan/template-not-found': GENERIC_ERROR_MESSAGE,
  'plan/week-out-of-range': GENERIC_ERROR_MESSAGE,
};
