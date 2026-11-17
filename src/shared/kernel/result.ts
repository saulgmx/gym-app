// Expected errors are values, not exceptions (ADR-0010).
export interface DomainError<C extends string = string> {
  code: C;
  message: string; // technical, for logs only; user messages come from app
  details?: unknown;
}

export type Result<T, E extends DomainError = DomainError> =
  { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E extends DomainError>(error: E): Result<never, E> => ({ ok: false, error });
