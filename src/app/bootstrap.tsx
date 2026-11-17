import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { compose } from './compose';
import { AppErrorBoundary } from './errors/AppErrorBoundary';
import { AppNotice } from './errors/AppNotice';
import { installGlobalErrorHandlers } from './errors/global-handlers';
import { createAppRouter } from './router';

interface BootstrapOptions {
  /** navigator.storage; a parameter so tests cover browsers without it (AC-33). */
  storage: Partial<Pick<StorageManager, 'persist'>> | undefined;
}

/** Starts the app (plan §5). Returns a function that unmounts it and removes the handlers. */
export function bootstrap(rootElement: HTMLElement, { storage }: BootstrapOptions): () => void {
  const uninstallHandlers = installGlobalErrorHandlers();

  // Not awaited and never rejects: a refusal must not reach the unhandledrejection handler.
  void storage?.persist?.().catch(() => undefined);

  // Modules are not passed to React until a page needs them (phase 1).
  compose();

  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <AppErrorBoundary>
        <RouterProvider router={createAppRouter()} />
        <AppNotice />
      </AppErrorBoundary>
    </StrictMode>,
  );

  return () => {
    root.unmount();
    uninstallHandlers();
  };
}
