import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { ClosePage } from './pages/ClosePage';
import { ProgressPage } from './pages/ProgressPage';
import { SessionPage } from './pages/SessionPage';
import { TodayPage } from './pages/TodayPage';

// Route table (spec §7.2, spec 000 §6). Exported so tests run it in a memory router.
// React Router ranks the static `cierre` segment above `:exerciseIndex` (AC-24).
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'progreso', element: <ProgressPage /> },
    ],
  },
  { path: 'sesion/:workoutId/:exerciseIndex', element: <SessionPage /> },
  { path: 'sesion/:workoutId/cierre', element: <ClosePage /> },
  // `replace` keeps the broken URL out of the history (AC-25).
  { path: '*', element: <Navigate to="/" replace /> },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
