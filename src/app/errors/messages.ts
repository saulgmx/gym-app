// User-facing error texts (ADR-0010). Only app maps error codes to Spanish messages.

/** Union of every module's error codes; empty until a module exports its codes. */
export type ErrorCode = never;

/** Adding a code to ErrorCode without its message here breaks tsc. */
// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type -- empty until ErrorCode has members
export const errorMessages: Record<ErrorCode, string> = {};

/** Generic text for unexpected errors (spec 000 §6). */
export const GENERIC_ERROR_MESSAGE =
  'Algo salió mal. Tus datos guardados no se han perdido. Recarga la app para continuar.';
