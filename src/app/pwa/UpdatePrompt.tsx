import { useRegisterSW } from 'virtual:pwa-register/react';
import { cx } from '@/shared/ui';
import styles from '../layout/notice.module.css';

// Offers a waiting service worker (registerType 'prompt', AC-32): never reloads without a tap.
// "Ahora no" hides it; the new version activates once the app is closed.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;

  return (
    <div role="status" className={styles.banner}>
      <p className={styles.message}>Hay una versión nueva.</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={() => void updateServiceWorker(true)}
        >
          Actualizar
        </button>
        <button
          type="button"
          className={cx(styles.button, styles.secondary)}
          onClick={() => {
            setNeedRefresh(false);
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
