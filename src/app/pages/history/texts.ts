// Texts of the history (spec 006 §6). Page texts live in app, as in the session and the Cierre.

export const HISTORY_TEXTS = {
  title: 'Historial',
  empty: 'Aún no hay sesiones guardadas. Cuando termines una, aparecerá aquí.',
  outside: 'Fuera del programa',
  redFlag: 'Señal de alarma',
} as const;

/** "Semana 2". */
export const formatWeekTitle = (programWeek: number) => `Semana ${String(programWeek)}`;
