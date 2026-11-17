import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

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
