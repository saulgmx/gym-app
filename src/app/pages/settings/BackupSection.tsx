import { Suspense, use, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import type { PendingImport } from '@/modules/data';
import { useApp } from '../../context';
import { describeImportError, GENERIC_ERROR_MESSAGE } from '../../errors/messages';
import { deliverFile } from './deliver';
import { ImportDialog } from './ImportDialog';
import { SETTINGS_TEXTS } from './texts';
import styles from './settings.module.css';

// "Respaldo" (spec 007 §6.1 to §6.3, plan §6.8). The text shows at once; the buttons wait for
// `ready` (decision 16 (a)).
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

// One thing at a time: a download and a restore never overlap (decision 17 (a)).
type State =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'checking' }
  | { kind: 'pending'; pending: PendingImport }
  | { kind: 'restoring'; pending: PendingImport };

// One message at a time (§6.3): "Respaldo restaurado." is a status, the rest are alerts.
type Message = { role: 'status' | 'alert'; text: string } | null;

function BackupActions() {
  const { data, ready } = useApp();
  use(ready);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [message, setMessage] = useState<Message>(null);
  const input = useRef<HTMLInputElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  // Bumped when the preview closes. The effect runs after Dialog gives the focus back to what
  // had it before, which may be the hidden input or nothing (decision 17 (f)).
  const [returnFocus, setReturnFocus] = useState(0);

  useEffect(() => {
    if (returnFocus > 0) restoreButton.current?.focus();
  }, [returnFocus]);

  async function download() {
    setMessage(null);
    setState({ kind: 'preparing' });
    try {
      const { filename, blob } = await data.exportAll();
      // Nothing shows after the sheet closes or the download starts (AC-6, decision 16 (b)).
      await deliverFile(new File([blob], filename, { type: 'application/json' }));
    } catch {
      // Caught here, so the global unhandledrejection notice does not repeat it (decision 16 (c)).
      setMessage({ role: 'alert', text: GENERIC_ERROR_MESSAGE });
    } finally {
      setState({ kind: 'idle' });
    }
  }

  async function review(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    // Cleared at once, so the same file picked again fires `change` (AC-21).
    event.currentTarget.value = '';
    if (!file) return; // the picker closed without a file (decision 17 (b))
    setMessage(null);
    setState({ kind: 'checking' });
    try {
      const result = await data.previewImport(file);
      if (result.ok) {
        setState({ kind: 'pending', pending: result.value });
        return;
      }
      setMessage({ role: 'alert', text: describeImportError(result.error) });
    } catch {
      setMessage({ role: 'alert', text: GENERIC_ERROR_MESSAGE }); // decision 17 (c)
    }
    setState({ kind: 'idle' });
  }

  async function restore(pending: PendingImport) {
    setState({ kind: 'restoring', pending });
    try {
      const result = await pending.commit();
      setMessage(
        result.ok
          ? { role: 'status', text: SETTINGS_TEXTS.restored }
          : { role: 'alert', text: describeImportError(result.error) }, // AC-28
      );
    } catch {
      setMessage({ role: 'alert', text: GENERIC_ERROR_MESSAGE }); // AC-27, decision 17 (d)
    }
    closePreview();
  }

  function closePreview() {
    setState({ kind: 'idle' });
    setReturnFocus((n) => n + 1);
  }

  const busy = state.kind !== 'idle';
  return (
    <>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => void download()}
        >
          {state.kind === 'preparing' ? SETTINGS_TEXTS.preparing : SETTINGS_TEXTS.download}
        </button>
        {/* The visible, labelled control; the input only opens the system picker (§6.2). */}
        <button
          ref={restoreButton}
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {state.kind === 'checking' ? SETTINGS_TEXTS.checking : SETTINGS_TEXTS.restore}
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          tabIndex={-1}
          onChange={(event) => void review(event)}
        />
      </div>
      {/* The status region stays mounted so "Respaldo restaurado." is announced; an alert is
          announced when it is inserted. */}
      <p role="status" className={styles.status}>
        {message?.role === 'status' ? message.text : ''}
      </p>
      {message?.role === 'alert' && (
        <p role="alert" className={styles.problem}>
          {message.text}
        </p>
      )}
      {(state.kind === 'pending' || state.kind === 'restoring') && (
        <ImportDialog
          preview={state.pending.preview}
          restoring={state.kind === 'restoring'}
          onConfirm={() => void restore(state.pending)}
          onCancel={closePreview}
        />
      )}
    </>
  );
}
