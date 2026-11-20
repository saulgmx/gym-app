import { Suspense, use, useId, useState } from 'react';
import { useApp } from '../../context';
import { GENERIC_ERROR_MESSAGE } from '../../errors/messages';
import { deliverFile } from './deliver';
import { SETTINGS_TEXTS } from './texts';
import styles from './settings.module.css';

// "Respaldo" (spec 007 §6.1, plan §6.8). The text shows at once; the buttons wait for `ready`
// (decision 16 (a)). "Restaurar respaldo" is wired in T17.
export function BackupSection() {
  const titleId = useId();
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h2 id={titleId}>{SETTINGS_TEXTS.backup}</h2>
      <p className={styles.text}>{SETTINGS_TEXTS.backupText}</p>
      <Suspense fallback={null}>
        <BackupActions />
      </Suspense>
    </section>
  );
}

function BackupActions() {
  const { data, ready } = useApp();
  use(ready);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState('');

  async function download() {
    setProblem('');
    setPreparing(true);
    try {
      const { filename, blob } = await data.exportAll();
      // Nothing shows after the sheet closes or the download starts (AC-6, decision 16 (b)).
      await deliverFile(new File([blob], filename, { type: 'application/json' }));
    } catch {
      // Caught here, so the global unhandledrejection notice does not repeat it (decision 16 (c)).
      setProblem(GENERIC_ERROR_MESSAGE);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={preparing}
          onClick={() => void download()}
        >
          {preparing ? SETTINGS_TEXTS.preparing : SETTINGS_TEXTS.download}
        </button>
        <button type="button" className={styles.secondary}>
          {SETTINGS_TEXTS.restore}
        </button>
      </div>
      {/* The status region stays mounted so "Respaldo restaurado." is announced (T17); an alert is
          announced when it is inserted. One message at a time (§6.3). */}
      <p role="status" className={styles.status} />
      {problem && (
        <p role="alert" className={styles.problem}>
          {problem}
        </p>
      )}
    </>
  );
}
