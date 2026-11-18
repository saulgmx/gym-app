import { describe, expect, it } from 'vitest';
import { discardDialogText } from '../pages/discard-dialog';

// Texts of the discard confirmation (spec 003 AC-23, AC-24; RN-TRN-15: the sets are kept, so the
// text never says they are deleted). "serie" and "ejercicio" agree each with its own number.

describe('discardDialogText', () => {
  it('AC-23: 3 series en 2 ejercicios', () => {
    expect(discardDialogText({ setsDone: 3, itemsWithDoneSets: 2 })).toEqual({
      title: '¿Descartar la sesión?',
      message:
        'Las 3 series que registraste en 2 ejercicios no contarán en tu historial. No se puede deshacer.',
      confirmLabel: 'Sí, descartar',
    });
  });

  it('AC-23: varias series en un solo ejercicio', () => {
    expect(discardDialogText({ setsDone: 2, itemsWithDoneSets: 1 }).message).toBe(
      'Las 2 series que registraste en 1 ejercicio no contarán en tu historial. No se puede deshacer.',
    );
  });

  it('AC-24: 1 serie, en singular', () => {
    expect(discardDialogText({ setsDone: 1, itemsWithDoneSets: 1 }).message).toBe(
      'La serie que registraste en 1 ejercicio no contará en tu historial. No se puede deshacer.',
    );
  });

  it('AC-24: ninguna serie', () => {
    expect(discardDialogText({ setsDone: 0, itemsWithDoneSets: 0 }).message).toBe(
      'No registraste ninguna serie. No se puede deshacer.',
    );
  });

  it('RN-TRN-15: el título y los botones no cambian con el número de series', () => {
    for (const counts of [
      { setsDone: 0, itemsWithDoneSets: 0 },
      { setsDone: 1, itemsWithDoneSets: 1 },
      { setsDone: 7, itemsWithDoneSets: 4 },
    ]) {
      const text = discardDialogText(counts);
      expect(text.title).toBe('¿Descartar la sesión?');
      expect(text.confirmLabel).toBe('Sí, descartar');
      expect(text.message).not.toMatch(/borr|elimin/i);
    }
  });
});
