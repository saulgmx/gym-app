import { redFlagMessage } from '../domain/pain';
import { RED_FLAGS, type RedFlag } from '../domain/types';
import styles from './pain.module.css';
import { SafetyNote } from './SafetyNote';

// Red flags of the Cierre (docs/modules/health.md §4, "Componentes"; spec 005 AC-13 to AC-15).
// The notice comes from the flags themselves, so it shows with no pain level chosen (contract v1.8).

const LABELS: Record<RedFlag, string> = {
  radiating: 'Dolor que baja por la pierna',
  numbness: 'Hormigueo o adormecimiento',
  weakness: 'Debilidad en el pie',
  bladder_bowel: 'Problemas de control de vejiga o intestino',
};

export function RedFlagsChecklist({
  value,
  onChange,
}: {
  value: RedFlag[];
  onChange: (flags: RedFlag[]) => void;
}) {
  const message = redFlagMessage(value);

  // Always in the order of RED_FLAGS, whatever the order of the taps.
  const toggle = (flag: RedFlag) => {
    onChange(RED_FLAGS.filter((f) => (f === flag ? !value.includes(f) : value.includes(f))));
  };

  return (
    <fieldset className={styles.flags}>
      <legend>
        <h2 className={styles.title}>Señales de alarma (opcional)</h2>
      </legend>
      {RED_FLAGS.map((flag) => (
        <label key={flag} className={styles.flag}>
          <input
            type="checkbox"
            checked={value.includes(flag)}
            onChange={() => {
              toggle(flag);
            }}
          />
          <span>{LABELS[flag]}</span>
        </label>
      ))}
      {/* Always in the DOM, so the first notice is announced too. */}
      <div aria-live="polite">{message ? <SafetyNote>{message}</SafetyNote> : null}</div>
    </fieldset>
  );
}
