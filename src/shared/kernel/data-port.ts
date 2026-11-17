import type { Result } from './result';

// Export/import contract each module with data implements (docs/modules/data.md §3).
// It lives in the kernel because no module may import `data`.
export interface DataPort<T = unknown> {
  name: string; // 'plan', 'training', 'health', 'progression', 'app'
  version: number; // export format version of this module
  order: number; // import order: plan 10, training 20, health 30, progression 35, app 40
  tables: string[]; // Dexie tables it touches (for the single transaction)
  exportData(): Promise<T>;
  validate(raw: unknown, fromVersion: number): Result<T>; // migrates and validates with Zod
  importData(data: T): Promise<void>; // replaces all module content; runs inside the transaction
  wipe(): Promise<void>;
  csv?(): Promise<{ filename: string; content: string }>;
}
