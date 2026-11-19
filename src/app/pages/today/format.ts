import { displayMinutes } from '@/modules/plan';

// Texts of "Hoy" (spec 003 plan §6.7). Durations come in seconds and are rounded here with
// plan's displayMinutes (RN-PLN-27), so a page cannot show an unrounded value. Every count
// agrees with its number ("1 ejercicio", "0 de 1 sesión").

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "7 ejercicios · ~50 min" (AC-1). */
export function formatSessionSummary(exercises: number, seconds: number): string {
  const noun = plural(exercises, 'ejercicio', 'ejercicios');
  return `${String(exercises)} ${noun} · ~${String(displayMinutes(seconds))} min`;
}

/** "1 de 7 ejercicios hechos" (AC-16, RN-TRN-21). */
export function formatItemsDone(done: number, total: number): string {
  return `${String(done)} de ${String(total)} ${plural(total, 'ejercicio hecho', 'ejercicios hechos')}`;
}

/** "Faltan ~25 min" (AC-16, RN-TRN-20). */
export function formatRemaining(seconds: number): string {
  return `Faltan ~${String(displayMinutes(seconds))} min`;
}

/** "Vas en: Press de banca con barra · serie 2" (AC-16). */
export function formatCurrent(exerciseName: string, setNumber: number): string {
  return `Vas en: ${exerciseName} · serie ${String(setNumber)}`;
}

/** "0 de 3 sesiones" (AC-10). */
export function formatWeekSessions(done: number, total: number): string {
  return `${String(done)} de ${String(total)} ${plural(total, 'sesión', 'sesiones')}`;
}

/** "52 min · 10 series", the card of a day already done (spec 005 AC-34). */
export function formatDoneSummary(minutes: number, sets: number): string {
  return `${String(minutes)} min · ${String(sets)} ${plural(sets, 'serie', 'series')}`;
}

/** "Espalda 5/10", the chip with the latest pain entry (spec 005 §6.3). */
export function formatBackChip(level: number): string {
  return `Espalda ${String(level)}/10`;
}
