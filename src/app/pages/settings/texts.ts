// Texts of Ajustes (spec 007 §6.1 and §8 decision 16). Page texts live in app, as in the history.

export const SETTINGS_TEXTS = {
  title: 'Ajustes',
  backup: 'Respaldo',
  backupText:
    'Tus datos solo están en este teléfono. Descarga un respaldo de vez en cuando y guárdalo en Archivos, iCloud o tu correo.',
  download: 'Descargar respaldo',
  preparing: 'Preparando respaldo…',
  restore: 'Restaurar respaldo',
  checking: 'Revisando…',
  restored: 'Respaldo restaurado.',
  // Preview (spec §6.2, AC-14 to AC-18)
  previewTitle: '¿Restaurar este respaldo?',
  inProgress: 'Incluye una sesión en curso.',
  replace: 'Reemplazar mis datos',
  restoring: 'Restaurando…',
  cancel: 'Cancelar',
  notice: 'Aviso',
  // [PROPUESTO] until T24 of spec 005, like the other health texts (spec 007 §8 decision 11).
  noticeText:
    'Esta app no es un dispositivo médico. Los avisos sobre el dolor lumbar son orientativos y no sustituyen la valoración de tu traumatólogo o fisioterapeuta.',
} as const;

/** "Respaldo del 19 de noviembre de 2026, 22:30". */
export const formatExportedAt = (when: string) => `Respaldo del ${when}`;

/** "Plan: empieza el lunes 16 de noviembre de 2026". */
export const formatPlanStart = (day: string) => `Plan: empieza el ${day}`;
