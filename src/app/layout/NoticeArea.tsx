import type { ReactNode } from 'react';
import styles from './notice.module.css';

// Fixed top area for global notices (plan §6.12).
export function NoticeArea({ children }: { children: ReactNode }) {
  return <div className={styles.area}>{children}</div>;
}
