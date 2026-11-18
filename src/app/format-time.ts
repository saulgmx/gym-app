// Durations shown by the app (spec 003 AC-17, spec 004 AC-2): "Hoy" and the session page share them.

const twoDigits = (n: number) => String(n).padStart(2, '0');

/** Elapsed time of a session: "18:42", "1:05:12" past an hour; a negative value (the clock
 *  went back) is "0:00" (AC-17). Fractions of a second are dropped, like a stopwatch. */
export function formatElapsed(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = twoDigits(total % 60);
  return hours > 0
    ? `${String(hours)}:${twoDigits(minutes)}:${rest}`
    : `${String(minutes)}:${rest}`;
}
