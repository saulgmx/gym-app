import './test-events';
import { describe, expectTypeOf, it } from 'vitest';
import { createEventBus, type DomainEvents, type EventBus } from '@/shared/events';

const bus = createEventBus();

describe('DomainEvents', () => {
  it('AC-21: cada evento declarado tiene su payload', () => {
    expectTypeOf<DomainEvents['test/Pinged']>().toEqualTypeOf<{ n: number }>();
    expectTypeOf(bus).toEqualTypeOf<EventBus>();
  });

  it('AC-21: publish acepta un evento declarado con su payload', () => {
    expectTypeOf(bus.publish).toBeCallableWith('test/Pinged', { n: 1 });
  });

  it('AC-21: publish rechaza un tipo no declarado', () => {
    // @ts-expect-error: 'test/Unknown' is not in DomainEvents
    bus.publish('test/Unknown', { n: 1 });
  });

  it('AC-21: publish rechaza un payload con forma incorrecta', () => {
    // @ts-expect-error: n must be a number
    bus.publish('test/Pinged', { n: '1' });
    // @ts-expect-error: n is missing
    bus.publish('test/Pinged', {});
    // @ts-expect-error: payload of another event
    bus.publish('test/Pinged', { text: 'pong' });
  });

  it('AC-21: subscribe tipa el payload del handler y devuelve la desuscripción', () => {
    const unsubscribe = bus.subscribe('test/Pinged', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{ n: number }>();
    });
    expectTypeOf(unsubscribe).toEqualTypeOf<() => void>();
    expectTypeOf(bus.subscribe).toBeCallableWith('test/Pinged', async () => {});
  });

  it('AC-21: subscribe rechaza un tipo no declarado o un handler incompatible', () => {
    // @ts-expect-error: 'test/Unknown' is not in DomainEvents
    bus.subscribe('test/Unknown', () => {});
    // @ts-expect-error: the handler expects another payload
    bus.subscribe('test/Pinged', (payload: { text: string }) => payload.text);
  });
});
