// Texts of the discard confirmation, shared by "Hoy" and the session page (spec 003 AC-23,
// AC-24, AC-26). Discarding keeps the sets (RN-TRN-15), so the text says they will not count,
// never that they are deleted. "serie" and "ejercicio" each agree with their own number.

const NO_UNDO = 'No se puede deshacer.';

export function discardDialogText({
  setsDone,
  itemsWithDoneSets,
}: {
  setsDone: number;
  itemsWithDoneSets: number;
}) {
  const exercises = `${String(itemsWithDoneSets)} ${itemsWithDoneSets === 1 ? 'ejercicio' : 'ejercicios'}`;
  let message: string;
  if (setsDone === 0) message = `No registraste ninguna serie. ${NO_UNDO}`;
  else if (setsDone === 1)
    message = `La serie que registraste en ${exercises} no contará en tu historial. ${NO_UNDO}`;
  else
    message = `Las ${String(setsDone)} series que registraste en ${exercises} no contarán en tu historial. ${NO_UNDO}`;
  return { title: '¿Descartar la sesión?', message, confirmLabel: 'Sí, descartar' };
}
