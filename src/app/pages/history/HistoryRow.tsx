import { Link } from 'react-router';
import type { PainEntry } from '@/modules/health';
import type { HistoryEntry } from '@/modules/training';
import { formatShortDay, formatWeekday } from '../../format-date';
import { formatBackChip } from '../../format-pain';
import { formatHistorySummary } from './format';
import { HISTORY_TEXTS } from './texts';
import styles from './history.module.css';

// One session of the list (spec 006 §6.1, AC-7 to AC-9; plan §6.7). The whole row is the link and
// its name is all its visible text (WCAG 2.5.3), so the parts are separated by real spaces between
// elements: the accessible name joins inline elements without one and trims each element's edges.
export function HistoryRow({ entry, pain }: { entry: HistoryEntry; pain: PainEntry | undefined }) {
  const { workout, summary } = entry;
  const name =
    workout.plannedFor === workout.date
      ? workout.name
      : `${workout.name} del ${formatWeekday(workout.plannedFor)}`;
  return (
    <li>
      <Link to={`/historial/${workout.id}`} state={{ from: '/historial' }} className={styles.row}>
        <span className={styles.text}>
          <span className={styles.title}>{`${formatShortDay(workout.date)} · ${name}`}</span>{' '}
          <span className={styles.summary}>{formatHistorySummary(summary)}</span>
        </span>
        {pain && ' '}
        {pain && (
          <span className={styles.chips}>
            <span className={styles.chip} data-warn={pain.level >= 4 ? '' : undefined}>
              {formatBackChip(pain.level)}
            </span>
            {pain.redFlags.length > 0 && (
              <>
                {' '}
                <span className={styles.chip} data-warn="">
                  {HISTORY_TEXTS.redFlag}
                </span>
              </>
            )}
          </span>
        )}
        <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.chevron}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </li>
  );
}
