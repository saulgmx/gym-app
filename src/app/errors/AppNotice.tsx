import { cx } from '@/shared/ui';
import styles from '../layout/notice.module.css';
import { useNoticeStore } from './notice-store';
import { reloadApp } from './reload';

// Non-blocking banner for async errors (AC-29); the page stays usable underneath.
export function AppNotice() {
  const notice = useNoticeStore((state) => state.notice);
  const dismissNotice = useNoticeStore((state) => state.dismissNotice);
  if (!notice) return null;

  return (
    <div role="alert" className={styles.banner}>
      <p className={styles.message}>{notice.message}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={reloadApp}>
          Recargar
        </button>
        <button
          type="button"
          className={cx(styles.button, styles.secondary)}
          onClick={dismissNotice}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
