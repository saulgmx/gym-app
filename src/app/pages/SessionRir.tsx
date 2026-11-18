import { formatRir, type PlannedItem } from '@/modules/plan';

/** The RIR of the session, once: every item has the same (RN-PLN-06, spec 003 plan §6.11). */
export function SessionRir({ items }: { items: PlannedItem[] }) {
  const first = items[0];
  return first ? <p>{formatRir(first.targetRir)}</p> : null;
}
