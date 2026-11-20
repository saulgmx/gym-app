// Texts of Ajustes (spec 007 §6.1 and §8 decision 16). Page texts live in app, as in the history.

export const SETTINGS_TEXTS = {
  title: 'Ajustes',
  backup: 'Respaldo',
  backupText:
    'Tus datos solo están en este teléfono. Descarga un respaldo de vez en cuando y guárdalo en Archivos, iCloud o tu correo.',
  download: 'Descargar respaldo',
  preparing: 'Preparando respaldo…',
  restore: 'Restaurar respaldo',
  notice: 'Aviso',
  // [PROPUESTO] until T24 of spec 005, like the other health texts (spec 007 §8 decision 11).
  noticeText:
    'Esta app no es un dispositivo médico. Los avisos sobre el dolor lumbar son orientativos y no sustituyen la valoración de tu traumatólogo o fisioterapeuta.',
} as const;
