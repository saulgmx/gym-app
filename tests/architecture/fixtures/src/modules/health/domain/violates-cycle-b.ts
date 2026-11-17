import { a } from './violates-cycle-a';
export const b = (): number => (Math.random() > 2 ? a() : 0);
