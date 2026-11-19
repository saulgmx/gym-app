// The back pain chip: "Hoy" and the history share it (spec 006 plan §6.10).

/** "Espalda 5/10", the chip with a pain entry (spec 005 §6.3). */
export function formatBackChip(level: number): string {
  return `Espalda ${String(level)}/10`;
}
