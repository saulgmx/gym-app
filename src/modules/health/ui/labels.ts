import { RED_FLAGS, type RedFlag } from '../domain/types';

// Labels of the red flags, the same in the Cierre and the history (spec 006 plan §6.4).

export const RED_FLAG_LABELS: Record<RedFlag, string> = {
  radiating: 'Dolor que baja por la pierna',
  numbness: 'Hormigueo o adormecimiento',
  weakness: 'Debilidad en el pie',
  bladder_bowel: 'Problemas de control de vejiga o intestino',
};

/** "Hormigueo o adormecimiento, Debilidad en el pie": in the order of RED_FLAGS; "" if none. */
export function formatRedFlags(flags: RedFlag[]): string {
  return RED_FLAGS.filter((flag) => flags.includes(flag))
    .map((flag) => RED_FLAG_LABELS[flag])
    .join(', ');
}
