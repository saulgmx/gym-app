import styles from './errors.module.css';
import { GENERIC_ERROR_MESSAGE } from './messages';
import { reloadApp } from './reload';

// Replaces the screen after a render error (AC-28): never a blank page.
export function ErrorFallback() {
  return (
    <main className={styles.screen}>
      <div role="alert" className={styles.panel}>
        <p className={styles.message}>{GENERIC_ERROR_MESSAGE}</p>
        <button type="button" className={styles.button} onClick={reloadApp}>
          Recargar
        </button>
      </div>
    </main>
  );
}
