import type { ImportPreview } from '@/modules/data';

// Texts of the restore preview with singular and plural (spec 007 §6.2, §8 decision 14 (e), (f)).

const count = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** "2 sesiones · 15 series · 2 registros de dolor", or "Sin sesiones guardadas" (AC-16). */
export function formatPreviewCounts(
  preview: Pick<ImportPreview, 'completedWorkouts' | 'doneSets' | 'painEntries'>,
): string {
  if (preview.completedWorkouts === 0) return 'Sin sesiones guardadas';
  return [
    count(preview.completedWorkouts, 'sesión', 'sesiones'),
    count(preview.doneSets, 'serie', 'series'),
    count(preview.painEntries, 'registro de dolor', 'registros de dolor'),
  ].join(' · ');
}

/** What restoring replaces on this device (AC-14, AC-18). */
export function formatReplaceWarning(currentCompletedWorkouts: number): string {
  if (currentCompletedWorkouts === 0) {
    return 'Se reemplazarán el plan y los datos de este dispositivo. No se puede deshacer.';
  }
  const sessions = count(currentCompletedWorkouts, 'sesión guardada', 'sesiones guardadas');
  return `Se reemplazarán todos los datos de este dispositivo: ${sessions}, el plan y el dolor lumbar. No se puede deshacer.`;
}
