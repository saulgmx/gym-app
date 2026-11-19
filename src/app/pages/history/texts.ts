// Texts of the history (spec 006 §6). Page texts live in app, as in the session and the Cierre.

export const HISTORY_TEXTS = {
  title: 'Historial',
  empty: 'Aún no hay sesiones guardadas. Cuando termines una, aparecerá aquí.',
  outside: 'Fuera del programa',
  redFlag: 'Señal de alarma',
  // Detail (spec 006 §6.2)
  back: 'Volver',
  notInHistory: 'Esta sesión no está en el historial.',
  seeHistory: 'Ver el historial',
  pain: 'Dolor lumbar',
  noPain: 'Sin registro',
  exercises: 'Ejercicios',
  noSets: 'Sin series',
  extra: 'Extra',
  notes: 'Notas',
} as const;

/** "Semana 2". */
export const formatWeekTitle = (programWeek: number) => `Semana ${String(programWeek)}`;

/** "Señales de alarma: Hormigueo o adormecimiento". */
export const formatRedFlagsLine = (labels: string) => `Señales de alarma: ${labels}`;

/** "En lugar de Dominadas". */
export const formatReplaces = (name: string) => `En lugar de ${name}`;

/** "Full body A · Historial · Gym". */
export const formatDetailTitle = (name: string) => `${name} · Historial · Gym`;
