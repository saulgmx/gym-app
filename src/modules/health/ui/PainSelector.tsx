import { useId } from 'react';
import { assessPain, bandMessage } from '../domain/pain';
import type { PainStatus } from '../domain/types';
import styles from './pain.module.css';

// Pain 0-10 of the Cierre (docs/modules/health.md §4, "Componentes"; spec 005 AC-10 to AC-12).
// The message comes from the value itself (contract v1.8). There is no way back to "none chosen":
// saving needs a level.

const LEVELS: { level: number; band: PainStatus }[] = Array.from({ length: 11 }, (_, level) => ({
  level,
  band: assessPain(level, []).status,
}));

export function PainSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (level: number) => void;
}) {
  const titleId = useId();
  const hintId = useId();
  const chosen = value === null ? undefined : LEVELS[value];

  return (
    <section className={styles.section}>
      <h2 id={titleId} className={styles.title}>
        Dolor lumbar
      </h2>
      <p id={hintId} className={styles.hint}>
        0 = nada, 10 = el peor dolor
      </p>
      <div
        role="group"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        className={styles.levels}
      >
        {LEVELS.map(({ level, band }) => (
          <button
            key={level}
            type="button"
            className={styles.level}
            aria-pressed={level === value}
            data-band={band}
            onClick={() => {
              onChange(level);
            }}
          >
            {level}
          </button>
        ))}
      </div>
      {/* Always in the DOM, so screen readers announce the first message too. */}
      <p aria-live="polite" className={styles.message} data-band={chosen?.band}>
        {value === null ? null : bandMessage(value)}
      </p>
    </section>
  );
}
