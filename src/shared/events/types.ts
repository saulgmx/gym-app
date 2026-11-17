// Event map: each module adds its events by declaration merging (architecture §7.2):
// declare module '@/shared/events' { interface DomainEvents { 'training/WorkoutCompleted': {...} } }
// It must start empty so modules can extend it.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DomainEvents {}

// Function properties, not methods: they don't use `this`, so they can be passed around unbound.
export interface EventBus {
  publish: <K extends keyof DomainEvents>(type: K, payload: DomainEvents[K]) => void;
  subscribe: <K extends keyof DomainEvents>(
    type: K,
    handler: (payload: DomainEvents[K]) => void | Promise<void>,
  ) => () => void;
}
