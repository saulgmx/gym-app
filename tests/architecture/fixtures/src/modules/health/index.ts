// A module's index.ts may use the shared kernel for its create<Module>(deps) types.
import { kernel } from '@/shared/kernel';

export const health = `health:${kernel}`;
