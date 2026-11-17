// Shared kernel (docs/modules/shared.md §2). UUIDv7 arrives in T10–T11.
export type { Clock, ID, IdGenerator, Instant, LocalDate, Weekday } from './types';
export { err, ok, type DomainError, type Result } from './result';
export { addDays, compareInstants, daysBetween, startOfIsoWeek, weekdayOf } from './time';
export { floorToStep, kgToLb, lbToKg, roundToStep } from './numbers';
export type { DataPort } from './data-port';
export { fixedClock, systemClock } from './clock';
export { sequentialIds } from './ids';
