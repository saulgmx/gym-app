import { createContext, use } from 'react';
import type { PlanApi } from '@/modules/plan';
import type { TrainingApi } from '@/modules/training';
import type { Clock } from '@/shared/kernel';

// Dependency injection for pages (spec 001 plan §5, §6.11): the value never changes, so this is
// not state and does not compete with Zustand (ADR-0006).
export interface AppServices {
  plan: PlanApi;
  training: TrainingApi;
  clock: Clock;
  ready: Promise<void>;
}

export const AppContext = createContext<AppServices | null>(null);

export function useApp(): AppServices {
  const app = use(AppContext);
  if (!app) throw new Error('AppContext is missing: render pages inside <AppContext value={...}>');
  return app;
}
