import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type { PlanSeed } from '../domain/types';
import type { planSeedSchema } from '../infrastructure/seed-schema';

describe('planSeedSchema', () => {
  it('RN-PLN-24 (l): la salida del esquema es exactamente PlanSeed', () => {
    // Fails to compile when the domain types and the schema drift apart, in either direction.
    expectTypeOf<z.output<typeof planSeedSchema>>().toEqualTypeOf<PlanSeed>();
  });
});
