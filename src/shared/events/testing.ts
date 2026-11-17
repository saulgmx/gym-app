// Test-only entry (docs/modules/shared.md §3); never re-exported from the public index.
import { settleAll } from './pending';

/** Waits for every pending handler of every bus, including events they publish in turn. */
export function flushEvents(): Promise<void> {
  return settleAll();
}
