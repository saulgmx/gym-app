// The summary figures of a session (RN-TRN-25): the Cierre and the history share them (spec 006
// plan §6.7, §6.8).

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
