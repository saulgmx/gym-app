/** Joins CSS Module class names, skipping falsy entries; always returns a string (shared.md §4). */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
