import { useId } from 'react';
import { Link } from 'react-router';
import { CLOSE_TEXTS } from './format';
import styles from './close.module.css';

// Fixed footer of the Cierre (spec 005 §6.1, AC-10, AC-17, AC-27): the error, the help, "Guardar
// sesión" and "Volver a la sesión".
export function CloseFooter({
  canSave,
  saving,
  error,
  backTo,
  onSave,
}: {
  canSave: boolean; // a pain level is chosen
  saving: boolean;
  error: string | null;
  backTo: string;
  onSave: () => void;
}) {
  const helpId = useId();
  return (
    <footer className={styles.footer}>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {canSave ? null : (
        <p id={helpId} className={styles.help}>
          {CLOSE_TEXTS.help}
        </p>
      )}
      <button
        type="button"
        className={styles.save}
        disabled={!canSave || saving}
        aria-describedby={canSave ? undefined : helpId}
        onClick={onSave}
      >
        {saving ? CLOSE_TEXTS.saving : CLOSE_TEXTS.save}
      </button>
      <Link to={backTo} className={styles.back}>
        {CLOSE_TEXTS.back}
      </Link>
    </footer>
  );
}
