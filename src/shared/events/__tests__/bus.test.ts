import './test-events';
import { describe, expect, it, vi } from 'vitest';
import * as events from '@/shared/events';
import { createEventBus } from '@/shared/events';
import { flushEvents } from '@/shared/events/testing';

const ping = { n: 1 };

describe('entrega', () => {
  it('AC-18: el handler no corre de forma síncrona; corre tras flushEvents con el payload', async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.subscribe('test/Pinged', handler);

    bus.publish('test/Pinged', ping);
    expect(handler).not.toHaveBeenCalled();

    await flushEvents();
    expect(handler).toHaveBeenCalledExactlyOnceWith(ping);
  });

  it('AC-18: solo recibe los eventos de su tipo', async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.subscribe('test/Ponged', handler);
    bus.publish('test/Pinged', ping);
    await flushEvents();
    expect(handler).not.toHaveBeenCalled();
  });

  it('los handlers corren en orden de suscripción', async () => {
    const bus = createEventBus();
    const calls: string[] = [];
    bus.subscribe('test/Pinged', () => void calls.push('a'));
    bus.subscribe('test/Pinged', () => void calls.push('b'));
    bus.publish('test/Pinged', ping);
    await flushEvents();
    expect(calls).toEqual(['a', 'b']);
  });

  it('un handler async lento no retrasa a los demás', async () => {
    const bus = createEventBus();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fast = vi.fn();
    bus.subscribe('test/Pinged', async () => {
      await gate;
    });
    bus.subscribe('test/Pinged', fast);

    bus.publish('test/Pinged', ping);
    await vi.waitFor(() => {
      expect(fast).toHaveBeenCalled();
    });

    release();
    await flushEvents();
  });
});

describe('flushEvents', () => {
  it('AC-18: espera a que terminen los handlers async', async () => {
    const bus = createEventBus();
    let done = false;
    bus.subscribe('test/Pinged', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      done = true;
    });
    bus.publish('test/Pinged', ping);
    await flushEvents();
    expect(done).toBe(true);
  });

  it('espera los eventos que los handlers publican en cascada', async () => {
    const bus = createEventBus();
    const ponged = vi.fn();
    bus.subscribe('test/Pinged', ({ n }) => {
      bus.publish('test/Ponged', { text: `pong ${String(n)}` });
    });
    bus.subscribe('test/Ponged', ponged);
    bus.publish('test/Pinged', ping);
    await flushEvents();
    expect(ponged).toHaveBeenCalledExactlyOnceWith({ text: 'pong 1' });
  });

  it('espera a todos los buses creados en la prueba', async () => {
    const [a, b] = [createEventBus(), createEventBus()];
    const [onA, onB] = [vi.fn(), vi.fn()];
    a.subscribe('test/Pinged', onA);
    b.subscribe('test/Pinged', onB);
    a.publish('test/Pinged', ping);
    b.publish('test/Pinged', ping);
    await flushEvents();
    expect(onA).toHaveBeenCalledOnce();
    expect(onB).toHaveBeenCalledOnce();
  });

  it('resuelve aunque no haya nada pendiente', async () => {
    await expect(flushEvents()).resolves.toBeUndefined();
  });

  it('no se exporta desde la entrada pública', () => {
    expect(Object.keys(events)).not.toContain('flushEvents');
  });
});

describe('aislamiento de fallos', () => {
  it('AC-19: si el primero lanza, el segundo corre, publish no lanza y onError recibe error y tipo', async () => {
    const onError = vi.fn();
    const bus = createEventBus({ onError });
    const boom = new Error('boom');
    const second = vi.fn();
    bus.subscribe('test/Pinged', () => {
      throw boom;
    });
    bus.subscribe('test/Pinged', second);

    expect(() => {
      bus.publish('test/Pinged', ping);
    }).not.toThrow();
    await flushEvents();

    expect(second).toHaveBeenCalledExactlyOnceWith(ping);
    expect(onError).toHaveBeenCalledExactlyOnceWith(boom, 'test/Pinged');
  });

  it('AC-19: una promesa rechazada también llega a onError', async () => {
    const onError = vi.fn();
    const bus = createEventBus({ onError });
    const boom = new Error('async boom');
    bus.subscribe('test/Pinged', () => Promise.reject(boom));
    bus.publish('test/Pinged', ping);
    await flushEvents();
    expect(onError).toHaveBeenCalledExactlyOnceWith(boom, 'test/Pinged');
  });

  it('AC-19: por omisión, el error se registra con console.error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = createEventBus();
    const boom = new Error('boom');
    bus.subscribe('test/Pinged', () => {
      throw boom;
    });
    bus.publish('test/Pinged', ping);
    await flushEvents();
    expect(log).toHaveBeenCalledExactlyOnceWith('[events] test/Pinged', boom);
    log.mockRestore();
  });
});

describe('desuscripción', () => {
  it('AC-20: tras llamar la función devuelta por subscribe, el handler ya no corre', async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('test/Pinged', handler);
    unsubscribe();
    bus.publish('test/Pinged', ping);
    await flushEvents();
    expect(handler).not.toHaveBeenCalled();
  });

  it('AC-20: desuscribirse entre publish y la entrega cancela la entrega', async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('test/Pinged', handler);
    bus.publish('test/Pinged', ping);
    unsubscribe();
    await flushEvents();
    expect(handler).not.toHaveBeenCalled();
  });

  it('suscribirse después de publish no recibe ese evento', async () => {
    const bus = createEventBus();
    const late = vi.fn();
    bus.publish('test/Pinged', ping);
    bus.subscribe('test/Pinged', late);
    await flushEvents();
    expect(late).not.toHaveBeenCalled();
  });

  it('desuscribirse dos veces no afecta a otros handlers', async () => {
    const bus = createEventBus();
    const other = vi.fn();
    const unsubscribe = bus.subscribe('test/Pinged', vi.fn());
    bus.subscribe('test/Pinged', other);
    unsubscribe();
    unsubscribe();
    bus.publish('test/Pinged', ping);
    await flushEvents();
    expect(other).toHaveBeenCalledOnce();
  });
});
