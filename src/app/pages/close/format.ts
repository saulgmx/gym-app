// Texts of the Cierre (spec 005 §6.1, plan §6.5). Page texts live in app, as in the session.

export const CLOSE_TEXTS = {
  done: 'Sesión terminada',
  title: 'Cierre de sesión',
  saved: 'Esta sesión ya está guardada.',
  nothingDone: 'No hay series hechas para guardar.',
  help: 'Elige el nivel de dolor para poder guardar',
  save: 'Guardar sesión',
  saving: 'Guardando…',
  back: 'Volver a la sesión',
  notes: 'Notas de la sesión (opcional)',
} as const;

/** A summary figure: the big number and the words after it ("52" + "min" reads "52 min"). */
export interface Figure {
  value: string;
  rest: string;
}

/** "52 min". */
export const minutesFigure = (minutes: number): Figure => ({
  value: String(minutes),
  rest: 'min',
});

/** "10 series", "1 serie". */
export const setsFigure = (n: number): Figure => ({
  value: String(n),
  rest: n === 1 ? 'serie' : 'series',
});

/** "7 ejercicios" when every item has a done set, "3 de 7 ejercicios" otherwise; "1 ejercicio". */
export function itemsFigure(withSets: number, total: number): Figure {
  const noun = total === 1 ? 'ejercicio' : 'ejercicios';
  return withSets === total
    ? { value: String(total), rest: noun }
    : { value: String(withSets), rest: `de ${String(total)} ${noun}` };
}
