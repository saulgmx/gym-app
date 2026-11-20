// Shared kernel (docs/modules/shared.md §2).
export type { Clock, ID, IdGenerator, Instant, LocalDate, Weekday } from './types';
export { err, ok, type DomainError, type Result } from './result';
export { addDays, compareInstants, daysBetween, startOfIsoWeek, weekdayOf } from './time';
export { floorToStep, kgToLb, lbToKg, roundToStep } from './numbers';
export type { DataPort } from './data-port';
export { idSchema, instantSchema, localDateSchema } from './schemas';
export { fixedClock, systemClock } from './clock';
export { createUuidV7Generator, sequentialIds } from './ids';
