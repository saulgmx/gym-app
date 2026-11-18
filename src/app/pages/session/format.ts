// Texts of the session page (spec 004 §6.3 and §6.6, plan §6.7). "ejercicio" agrees with the
// total, as "N de M ejercicios hechos" does in "Hoy".

/** "Llevas 1 de 7 ejercicios y 18:42 de entrenamiento."; without the time for a session of
 *  another day (AC-12, AC-18). */
export function formatExitSummary(done: number, total: number, elapsed: string | null): string {
  const noun = total === 1 ? 'ejercicio' : 'ejercicios';
  const time = elapsed === null ? '' : ` y ${elapsed} de entrenamiento`;
  return `Llevas ${String(done)} de ${String(total)} ${noun}${time}.`;
}

/** "Siguiente: Dominadas · 2 × 6-10", or "Último ejercicio de hoy" on the last one, whatever
 *  day the session is from (AC-31 to AC-34). */
export function formatNextLine(next: { name: string; target: string } | null): string {
  return next ? `Siguiente: ${next.name} · ${next.target}` : 'Último ejercicio de hoy';
}
