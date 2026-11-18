import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog, Dialog } from '@/shared/ui';
import { discardDialogText } from '../discard-dialog';
import styles from './ExitSheet.module.css';

interface ExitSheetProps {
  open: boolean;
  /** "Llevas N de M ejercicios[ y m:ss de entrenamiento]." computed when the sheet opened. */
  summary: string;
  /** For the discard confirmation text (spec 003 AC-23, AC-24). */
  counts: { setsDone: number; itemsWithDoneSets: number };
  /** "Seguir entrenando", Escape or the backdrop. */
  onClose: () => void;
  /** "Sí, descartar": the page discards, then leaves or shows the reason. */
  onDiscard: () => void;
}

// The exit sheet and its discard confirmation (spec 004 §6.3, AC-12 to AC-18; plan §6.8). Two
// modal dialogs cannot be open at once without stacking, so the sheet closes while the
// confirmation is open, and Cancel, Escape or the backdrop of the confirmation bring it back.
export function ExitSheet({ open, summary, counts, onClose, onDiscard }: ExitSheetProps) {
  const [confirming, setConfirming] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const summaryId = useId();
  const leaveId = useId();
  const leaveHintId = useId();
  const discardId = useId();
  const discardHintId = useId();

  return (
    <>
      <Dialog
        open={open && !confirming}
        placement="bottom"
        dismissOnBackdrop
        labelledBy={titleId}
        describedBy={summaryId}
        initialFocus={keep}
        onClose={onClose}
      >
        <h2 id={titleId} className={styles.title}>
          ¿Salir de la sesión?
        </h2>
        <p id={summaryId} className={styles.summary}>
          {summary}
        </p>
        <div className={styles.options}>
          <button ref={keep} type="button" className={styles.keep} onClick={onClose}>
            Seguir entrenando
          </button>
          {/* Named by the main text; the subtitle is the description (spec 004 §6.3). */}
          <Link
            to="/"
            className={styles.option}
            aria-labelledby={leaveId}
            aria-describedby={leaveHintId}
          >
            <span id={leaveId} className={styles.optionTitle}>
              Salir y continuar después
            </span>
            <span id={leaveHintId} className={styles.optionHint}>
              Hoy mostrará &quot;Continuar sesión&quot;
            </span>
          </Link>
          <button
            type="button"
            className={styles.discard}
            aria-labelledby={discardId}
            aria-describedby={discardHintId}
            onClick={() => {
              setConfirming(true);
            }}
          >
            <span id={discardId} className={styles.optionTitle}>
              Descartar sesión
            </span>
            <span id={discardHintId} className={styles.optionHint}>
              Las series no contarán en tu historial
            </span>
          </button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={open && confirming}
        {...discardDialogText(counts)}
        destructive
        dismissOnBackdrop
        onConfirm={() => {
          setConfirming(false);
          onDiscard();
        }}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </>
  );
}
