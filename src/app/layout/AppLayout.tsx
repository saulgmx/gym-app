import { Outlet } from 'react-router';
import styles from './AppLayout.module.css';
import { TabBar } from './TabBar';

// Layout for the tabbed pages; the session flow renders full screen without it (AC-24).
export function AppLayout() {
  return (
    <>
      <main className={styles.content}>
        <Outlet />
      </main>
      <TabBar />
    </>
  );
}
