import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { systemClock } from '@/shared/kernel';
import { compose } from './compose';
import { openDatabase } from './db';
import { AppErrorBoundary } from './errors/AppErrorBoundary';
import { AppNotice } from './errors/AppNotice';
import { installGlobalErrorHandlers } from './errors/global-handlers';
import { NoticeArea } from './layout/NoticeArea';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { createAppRouter } from './router';
import planSeed from './seed/plan-seed.json';

interface BootstrapOptions {
  /** navigator.storage; a parameter so tests cover browsers without it (AC-33). */
  storage: Partial<Pick<StorageManager, 'persist'>> | undefined;
}

/** Starts the app (plan §5). Returns a function that unmounts it and removes the handlers. */
export function bootstrap(rootElement: HTMLElement, { storage }: BootstrapOptions): () => void {
  const uninstallHandlers = installGlobalErrorHandlers();

  // Not awaited and never rejects: a refusal must not reach the unhandledrejection handler.
  void storage?.persist?.().catch(() => undefined);

  // Not awaited: `ready` reaches the pages through AppContext in T17 (spec 001, plan §5).
  compose({ db: openDatabase(), clock: systemClock, seed: planSeed });

  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <AppErrorBoundary>
        <RouterProvider router={createAppRouter()} />
        <NoticeArea>
          <AppNotice />
          <UpdatePrompt />
        </NoticeArea>
      </AppErrorBoundary>
    </StrictMode>,
  );

  return () => {
    root.unmount();
    uninstallHandlers();
  };
}
