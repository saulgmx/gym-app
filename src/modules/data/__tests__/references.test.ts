import { describe, expect, it } from 'vitest';
import type { DataDescription, ID } from '@/shared/kernel';
import { missingReference } from '../domain/references';

// RN-DAT-11 (contract v1.3, §6 "Detalle de la revisión"): references between modules,
// checked on the file's own content, in port order.

const id = (s: string) => s as ID;

const describeAs = (
  provides: DataDescription['provides'],
  requires: DataDescription['requires'] = {},
): DataDescription => ({ facts: {}, provides, requires });

const plan = describeAs({ exercise: [id('ex-1'), id('ex-2')] });
const training = describeAs(
  { workout: [id('w-1'), id('w-2')] },
  { exercise: [id('ex-1'), id('ex-2'), id('ex-1')] },
);
const health = describeAs({}, { workout: [id('w-2')] });

describe('missingReference', () => {
  it('RN-DAT-11: todas las referencias presentes → null (los repetidos no importan)', () => {
    expect(
      missingReference([
        { name: 'plan', description: plan },
        { name: 'training', description: training },
        { name: 'health', description: health },
      ]),
    ).toBeNull();
  });

  it('RN-DAT-11: un ejercicio que no está en el plan → módulo, tipo e id', () => {
    const broken = describeAs({ workout: [id('w-1')] }, { exercise: [id('ex-1'), id('ex-9')] });
    expect(
      missingReference([
        { name: 'plan', description: plan },
        { name: 'training', description: broken },
      ]),
    ).toEqual({ module: 'training', kind: 'exercise', id: 'ex-9' });
  });

  it('RN-DAT-11: un workout que no está → la entrada de dolor es la rota', () => {
    const orphan = describeAs({}, { workout: [id('w-7')] });
    expect(
      missingReference([
        { name: 'plan', description: plan },
        { name: 'training', description: training },
        { name: 'health', description: orphan },
      ]),
    ).toEqual({ module: 'health', kind: 'workout', id: 'w-7' });
  });

  it('RN-DAT-11: la primera rota va en orden de puertos, luego de tipos y luego de ids', () => {
    const a = describeAs({}, { exercise: [id('ok'), id('a-1'), id('a-2')], workout: [id('a-3')] });
    const b = describeAs({ exercise: [id('ok')] }, { exercise: [id('b-1')] });
    expect(
      missingReference([
        { name: 'first', description: a },
        { name: 'second', description: b },
      ]),
    ).toEqual({ module: 'first', kind: 'exercise', id: 'a-1' });
  });

  it('RN-DAT-11: un puerto puede ofrecer lo que él mismo requiere', () => {
    const self = describeAs({ workout: [id('w-1')] }, { workout: [id('w-1')] });
    expect(missingReference([{ name: 'training', description: self }])).toBeNull();
  });

  it('RN-DAT-11: lo que ofrece un puerto posterior también cuenta', () => {
    expect(
      missingReference([
        { name: 'health', description: health },
        { name: 'training', description: training },
        { name: 'plan', description: plan },
      ]),
    ).toBeNull();
  });

  it('RN-DAT-11: un tipo que nadie ofrece está roto', () => {
    const lonely = describeAs({}, { template: [id('t-1')] });
    expect(missingReference([{ name: 'x', description: lonely }])).toEqual({
      module: 'x',
      kind: 'template',
      id: 't-1',
    });
  });

  it('RN-DAT-11: un tipo requerido con lista vacía no rompe nada', () => {
    const empty = describeAs({}, { template: [] });
    expect(missingReference([{ name: 'x', description: empty }])).toBeNull();
  });

  it('RN-DAT-11: los ids de un tipo no cubren otro tipo con el mismo valor', () => {
    const mixed = describeAs({ exercise: [id('same')] }, { workout: [id('same')] });
    expect(missingReference([{ name: 'x', description: mixed }])).toEqual({
      module: 'x',
      kind: 'workout',
      id: 'same',
    });
  });
});
