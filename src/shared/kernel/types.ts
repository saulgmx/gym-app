// Branded primitives (ADR-0009): plain strings are not accepted where these are expected.
export type ID = string & { readonly __brand: 'ID' }; // UUIDv7
export type LocalDate = string & { readonly __brand: 'LocalDate' }; // 'YYYY-MM-DD'
export type Instant = string & { readonly __brand: 'Instant' }; // ISO 8601 with offset
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, as Date.getDay

export interface Clock {
  now(): Instant;
  today(): LocalDate;
}

export interface IdGenerator {
  next(): ID;
}
