import type { PlannedItem } from '../domain/types';
import { formatSetsReps } from './format';
import styles from './PlanExerciseList.module.css';

// Exercises of the day (spec 001 AC-15, plan §6.10). Only the list: TodayPage adds the card and
// the session heading. No RIR per row: it is the same for every item (RN-PLN-06), so the pages
// show it once (spec 003 plan §6.11). Alternatives are not shown in phase 1 (contract, decision 2). Each text is
// its own block so screen readers do not run them together.
export function PlanExerciseList({ items }: { items: PlannedItem[] }) {
  return (
    <ol className={styles.list}>
      {items.map((item) => (
        <li key={item.order} className={styles.item}>
          <div className={styles.main}>
            <div className={styles.name}>{item.exercise.name}</div>
            <div className={styles.dose}>
              {formatSetsReps(item.plannedSets, item.repRange, item.exercise.metric)}
            </div>
          </div>
          {item.note !== undefined && <div className={styles.detail}>{item.note}</div>}
        </li>
      ))}
    </ol>
  );
}
