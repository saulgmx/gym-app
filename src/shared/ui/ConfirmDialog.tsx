import { useId, useRef } from 'react';
import { cx } from './cx';
import { Dialog } from './Dialog';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  dismissOnBackdrop?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirmation sheet (modules/shared.md §4, ConfirmDialog), built on Dialog. Controlled: the page
// owns `open`. Focus starts on Cancel so a stray Enter or tap never confirms (P-2). Escape, and
// the backdrop only with dismissOnBackdrop, cancel.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  dismissOnBackdrop = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  return (
    <Dialog
      open={open}
      placement="bottom"
      dismissOnBackdrop={dismissOnBackdrop}
      labelledBy={titleId}
      describedBy={messageId}
      initialFocus={cancel}
      onClose={onCancel}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <p id={messageId} className={styles.message}>
        {message}
      </p>
      <div className={styles.actions}>
        <button ref={cancel} type="button" className={styles.button} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={cx(styles.button, destructive ? styles.destructive : styles.confirm)}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
