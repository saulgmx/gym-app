import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { cx } from './cx';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  placement: 'bottom' | 'top';
  dismissOnBackdrop?: boolean;
  labelledBy: string;
  describedBy?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

// The first control in document order when no initialFocus comes (modules/shared.md §4).
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([disabled])';

// Native modal dialog (modules/shared.md §4, Dialog; spec 004 plan §6.1). Controlled: the owner
// keeps `open` and decides what Escape and the backdrop do. Focus is moved by hand on open and
// given back on close, because WebKit does not always do either.
export function Dialog({
  open,
  onClose,
  placement,
  dismissOnBackdrop = false,
  labelledBy,
  describedBy,
  initialFocus,
  className,
  children,
}: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  // A drag that starts inside and ends on the backdrop sends its click to the dialog too.
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const previous = document.activeElement;
    element.showModal();
    const target = initialFocus?.current ?? element.querySelector<HTMLElement>(FOCUSABLE);
    (target ?? element).focus();
    return () => {
      element.close();
      // A screen mounted again (the menu after navigating) takes the focus itself.
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open, initialFocus]);

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      data-placement={placement}
      className={cx(styles.dialog, className)}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Escape fires `cancel`: the owner decides, instead of the browser closing it alone.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // The dialog has no padding and its content fills it, so only the backdrop targets it.
      onPointerDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        const onBackdrop = pressedOnBackdrop.current && event.target === event.currentTarget;
        pressedOnBackdrop.current = false;
        if (onBackdrop && dismissOnBackdrop) onClose();
      }}
    >
      <div className={styles.content}>{children}</div>
    </dialog>
  );
}
