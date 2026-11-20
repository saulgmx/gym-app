import type { DataDescription, ID } from '@/shared/kernel';

// RN-DAT-11 (contract v1.3 §6 "Detalle de la revisión"): every ID a module requires must be
// provided by some module of the same file. Ports never see each other's data; only their IDs.

export interface MissingReference {
  module: string;
  kind: string;
  id: ID;
}

/** The first broken reference, in port order, then kind order, then ID order; or null. */
export function missingReference(
  described: { name: string; description: DataDescription }[],
): MissingReference | null {
  const provided = new Map<string, Set<ID>>();
  for (const { description } of described) {
    for (const [kind, ids] of Object.entries(description.provides)) {
      const set = provided.get(kind) ?? new Set<ID>();
      for (const id of ids) set.add(id);
      provided.set(kind, set);
    }
  }

  for (const { name, description } of described) {
    for (const [kind, ids] of Object.entries(description.requires)) {
      const available = provided.get(kind);
      const id = ids.find((required) => !available?.has(required));
      if (id !== undefined) return { module: name, kind, id };
    }
  }
  return null;
}
