import { track } from './pending';
import type { EventBus } from './types';

type Handler = (payload: unknown) => void | Promise<void>;
// One entry per subscribe call, so the same handler can be subscribed and removed independently.
interface Subscription {
  handler: Handler;
}

// In-memory bus (docs/modules/shared.md §3): fire-and-forget, one microtask per handler.
export function createEventBus(
  opts: { onError?: (error: unknown, type: string) => void } = {},
): EventBus {
  const onError =
    opts.onError ??
    ((error: unknown, type: string) => {
      console.error(`[events] ${type}`, error);
    });
  const subscriptions = new Map<string, Set<Subscription>>();

  return {
    publish(type, payload) {
      const subs = subscriptions.get(type);
      if (!subs) return;
      // Recipients are fixed now; one that unsubscribes before delivery is skipped.
      for (const sub of [...subs]) {
        track(
          Promise.resolve()
            .then(async () => {
              if (subs.has(sub)) await sub.handler(payload);
            })
            .catch((error: unknown) => {
              onError(error, type);
            }),
        );
      }
    },

    subscribe(type, handler) {
      const sub: Subscription = { handler: handler as Handler };
      let subs = subscriptions.get(type);
      if (!subs) {
        subs = new Set();
        subscriptions.set(type, subs);
      }
      subs.add(sub);
      const owner = subs;
      return () => {
        owner.delete(sub);
      };
    },
  };
}
