import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
// Global stylesheets, in cascade order (plan §6.10).
import '@/shared/ui/tokens.css';
import '@/shared/ui/fonts.css';
import '@/shared/ui/base.css';
import { createAppRouter } from './router';

// Minimal entry point; the full bootstrap (error handlers, storage.persist, compose) arrives in T17.
const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={createAppRouter()} />
  </StrictMode>,
);
