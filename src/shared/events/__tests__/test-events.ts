// Example events for the bus tests only. The `test/` prefix makes any use outside tests obvious.
declare module '@/shared/events' {
  interface DomainEvents {
    'test/Pinged': { n: number };
    'test/Ponged': { text: string };
  }
}

export {};
