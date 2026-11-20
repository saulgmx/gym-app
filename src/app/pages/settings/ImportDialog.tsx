import { useId, useRef } from 'react';
import type { ImportPreview } from '@/modules/data';
import { Dialog } from '@/shared/ui';
import { formatDateRangeLong, formatInstantLong, formatWeekdayDateLong } from '../../format-date';
import { formatPreviewCounts, formatReplaceWarning } from './format';
import { formatExportedAt, formatPlanStart, SETTINGS_TEXTS } from './texts';
import styles from './settings.module.css';

// The restore preview (spec 007 §6.2, AC-14 to AC-19; plan §6.8). Focus starts on "Cancelar" so
// a stray Enter never replaces the data (P-2). While restoring nothing closes it.
export function ImportDialog({
  preview,
  restoring,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview;
  restoring: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const warningId = useId();
  const { dateRange } = preview;

  return (
    <Dialog
      open
      placement="bottom"
      dismissOnBackdrop
      labelledBy={titleId}
      describedBy={warningId}
      initialFocus={cancel}
      onClose={() => {
        if (!restoring) onCancel();
      }}
    >
      <h2 id={titleId} className={styles.dialogTitle}>
        {SETTINGS_TEXTS.previewTitle}
      </h2>
      <div className={styles.lines}>
        <p>{formatExportedAt(formatInstantLong(preview.exportedAt))}</p>
        <p>{formatPreviewCounts(preview)}</p>
        {dateRange && <p>{formatDateRangeLong(dateRange.from, dateRange.to)}</p>}
        {preview.hasActiveWorkout && <p>{SETTINGS_TEXTS.inProgress}</p>}
        <p>{formatPlanStart(formatWeekdayDateLong(preview.programStartDate))}</p>
      </div>
      <p id={warningId} className={styles.warning}>
        {formatReplaceWarning(preview.currentCompletedWorkouts)}
      </p>
      <div className={styles.dialogActions}>
        <button
          ref={cancel}
          type="button"
          className={styles.cancel}
          disabled={restoring}
          onClick={onCancel}
        >
          {SETTINGS_TEXTS.cancel}
        </button>
        <button type="button" className={styles.replace} disabled={restoring} onClick={onConfirm}>
          {restoring ? SETTINGS_TEXTS.restoring : SETTINGS_TEXTS.replace}
        </button>
      </div>
    </Dialog>
  );
}
