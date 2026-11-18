import type { LocalDate } from '@/shared/kernel';
import type { ProgramPosition } from '@/modules/plan';
import { formatShortDateTitle } from '../../format-date';
import styles from './TodayHeader.module.css';

// Top row of "Hoy" (spec 003 §6.1, AC-1, AC-9): the short date and the week chip. Outside the
// program, only the date. The page h1 stays visually hidden, so the date is the first thing seen.
export function TodayHeader({ date, position }: { date: LocalDate; position: ProgramPosition }) {
  return (
    <div className={styles.header}>
      <p className={styles.date}>{formatShortDateTitle(date)}</p>
      {position.status === 'active' && position.week !== null && (
        <p className={styles.chip}>
          {`Semana ${String(position.week)} de ${String(position.totalWeeks)}`}
        </p>
      )}
    </div>
  );
}
