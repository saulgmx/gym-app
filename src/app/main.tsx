import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Global stylesheets, in cascade order (plan §6.10).
import '@/shared/ui/tokens.css';
import '@/shared/ui/fonts.css';
import '@/shared/ui/base.css';

// Minimal entry point for T1; the full bootstrap (error handlers, storage.persist, compose) arrives in T17.
const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Hoy</h1>
    </main>
  </StrictMode>,
);
