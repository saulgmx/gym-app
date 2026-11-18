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
      <NavLink to="/progreso" className={cx(styles.tab)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.icon}>
          <path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-6" />
        </svg>
        Progreso
      </NavLink>
    </nav>
  );
}
