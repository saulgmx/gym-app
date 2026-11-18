import { Component, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useActiveWorkout } from '@/modules/training';
import { cx } from '@/shared/ui';
import { useApp } from '../context';
import styles from '../layout/notice.module.css';

// Offers a waiting service worker (registerType 'prompt', AC-32): never reloads without a tap.
// "Ahora no" hides it; the new version activates once the app is closed. Deferred while a session
// is active or still being looked up (spec 002 AC-37, plan §6.8): needRefresh stays true, so the
// prompt shows once the session is discarded.
export function UpdatePrompt() {
  return (
    <HiddenOnError>
      <Prompt />
    </HiddenOnError>
  );
}

function Prompt() {
  const { training } = useApp();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const active = useActiveWorkout(training);
  if (!needRefresh || active !== null) return null;

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

// A failing active-session query (RN-TRN-19) hides the prompt instead of taking the whole app
// down: the page shows its own error.
class HiddenOnError extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
