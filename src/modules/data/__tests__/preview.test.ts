import { describe, expect, it } from 'vitest';
import type { ImportFacts, Instant, LocalDate } from '@/shared/kernel';
import { buildPreview } from '../domain/preview';

// RN-DAT-13 (contract v1.3, §6 "Detalle de la revisión"): the preview merges each port's facts.

const date = (s: string) => s as LocalDate;
const header = { exportedAt: '2026-11-19T22:30:00-06:00' as Instant, schemaVersion: 1 };

// Spec 007 §4: L16 (10 sets) and M18 (5 sets) completed; the discarded one does not count.
const planFacts: ImportFacts = { programStartDate: date('2026-11-16') };
const trainingFacts: ImportFacts = {
  completedWorkouts: 2,
  doneSets: 15,
  dateRange: { from: date('2026-11-16'), to: date('2026-11-18') },
  hasActiveWorkout: false,
};
const healthFacts: ImportFacts = { painEntries: 2 };

describe('buildPreview', () => {
  it('RN-DAT-13: junta las cifras de cada puerto y las del dispositivo (spec §4, AC-14)', () => {
    expect(
      buildPreview(
        header,
        [planFacts, trainingFacts, healthFacts],
        [{}, { completedWorkouts: 3 }, {}],
      ),
    ).toEqual({
      exportedAt: '2026-11-19T22:30:00-06:00',
      schemaVersion: 1,
      completedWorkouts: 2,
      doneSets: 15,
      painEntries: 2,
      dateRange: { from: '2026-11-16', to: '2026-11-18' },
      hasActiveWorkout: false,
      programStartDate: '2026-11-16',
      currentCompletedWorkouts: 3,
    });
  });

  it('RN-DAT-13: lo que ningún puerto aporta queda en 0, null o false (AC-16, AC-18)', () => {
    expect(buildPreview(header, [planFacts], [])).toEqual({
      ...header,
      completedWorkouts: 0,
      doneSets: 0,
      painEntries: 0,
      dateRange: null,
      hasActiveWorkout: false,
      programStartDate: '2026-11-16',
      currentCompletedWorkouts: 0,
    });
  });

  it('RN-DAT-13: un archivo con una sesión en curso lo dice (AC-17), aunque el dispositivo no tenga', () => {
    const preview = buildPreview(
      header,
      [planFacts, { ...trainingFacts, hasActiveWorkout: true }],
      [{ hasActiveWorkout: false }],
    );
    expect(preview.hasActiveWorkout).toBe(true);
  });

  it('RN-DAT-13: una sesión en curso local no cambia hasActiveWorkout de la vista previa', () => {
    const preview = buildPreview(header, [planFacts, trainingFacts], [{ hasActiveWorkout: true }]);
    expect(preview.hasActiveWorkout).toBe(false);
  });

  it('RN-DAT-13: dateRange null explícito se respeta como aporte', () => {
    const preview = buildPreview(
      header,
      [planFacts, { completedWorkouts: 0, dateRange: null }],
      [],
    );
    expect(preview.dateRange).toBeNull();
  });

  it('RN-DAT-13: un 0 o false explícito es un aporte (no se confunde con "sin dato")', () => {
    expect(() => buildPreview(header, [planFacts, { doneSets: 0 }, { doneSets: 4 }], [])).toThrow(
      /RN-DAT-13.*doneSets/,
    );
  });

  it('RN-DAT-13: una clave con undefined no cuenta como aporte', () => {
    // exactOptionalPropertyTypes forbids it by type; a port written in plain JS could still send it.
    const loose = { painEntries: undefined } as unknown as ImportFacts;
    const preview = buildPreview(header, [planFacts, loose, healthFacts], []);
    expect(preview.painEntries).toBe(2);
  });

  it('RN-DAT-13: dos puertos que aportan la misma cifra lanzan (error de composición)', () => {
    expect(() => buildPreview(header, [planFacts, trainingFacts, trainingFacts], [])).toThrow(
      /RN-DAT-13.*completedWorkouts/,
    );
  });

  it('RN-DAT-13: dos puertos que aportan la misma cifra local también lanzan', () => {
    expect(() =>
      buildPreview(header, [planFacts], [{ completedWorkouts: 1 }, { completedWorkouts: 2 }]),
    ).toThrow(/RN-DAT-13.*completedWorkouts/);
  });

  it('RN-DAT-13: sin programStartDate lanza (el archivo siempre trae un plan)', () => {
    expect(() => buildPreview(header, [trainingFacts, healthFacts], [])).toThrow(
      /RN-DAT-13.*programStartDate/,
    );
  });
});
