import { b } from './violates-cycle-b';
export const a = (): number => b() + 1;
