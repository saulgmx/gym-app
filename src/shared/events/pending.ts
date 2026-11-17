// Deliveries in flight across every bus, so tests can wait for them (flushEvents).
const pending = new Set<Promise<void>>();

// The tracked promise must never reject: the bus routes handler errors to onError first.
export function track(delivery: Promise<void>): void {
  pending.add(delivery);
  void delivery.finally(() => pending.delete(delivery));
}

// Loops because a handler may publish more events while we wait (cascades).
export async function settleAll(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled([...pending]);
  }
}
