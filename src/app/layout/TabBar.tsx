import { Link, NavLink, useMatch } from 'react-router';
import { cx } from '@/shared/ui';
import styles from './TabBar.module.css';

// Bottom navigation (spec §7.1, spec 000 §6). NavLink sets aria-current="page" on the active tab
// (AC-22), and the stylesheet highlights it through that same attribute.
export function TabBar() {
  // Another day of the week (/dia/:date) belongs to "Hoy" (spec 002 plan §6.7), which NavLink
  // cannot express, so "Hoy" sets aria-current itself.
  const onRoot = useMatch('/') !== null;
  const onOtherDay = useMatch('/dia/:date') !== null;
  return (
    <nav aria-label="Principal" className={styles.bar}>
      <Link
        to="/"
        className={cx(styles.tab)}
        aria-current={onRoot || onOtherDay ? 'page' : undefined}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.icon}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        Hoy
      </Link>
      {/* Without `end`, so the tab stays current on a session detail (spec 006 AC-3). */}
      <NavLink to="/historial" className={cx(styles.tab)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.icon}>
          <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
        Historial
      </NavLink>
      <NavLink to="/progreso" className={cx(styles.tab)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.icon}>
          <path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-6" />
        </svg>
        Progreso
      </NavLink>
      {/* Spec 007 AC-1: the fourth tab, with a gear. */}
      <NavLink to="/ajustes" className={cx(styles.tab)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.icon}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Ajustes
      </NavLink>
    </nav>
  );
}
