// In-memory event bus (docs/modules/shared.md §3). flushEvents lives in ./testing on purpose.
export type { DomainEvents, EventBus } from './types';
export { createEventBus } from './bus';
