import { workoutSummary, type WorkoutView } from '@/modules/training';
import type { Instant } from '@/shared/kernel';
import { itemsFigure, minutesFigure, setsFigure, type Figure } from '../format-summary';
import styles from './SummaryFigures.module.css';

// The three figures of a session (RN-TRN-25): the Cierre (spec 005 §6.1, AC-7 to AC-9) and the
// history detail (spec 006 §6.2). In the Cierre, `now` and `showTime` are fixed when the page
// opens and sets and exercises follow the live view (spec 005 §7).
export function SummaryFigures({
  view,
  now,
  showTime,
}: {
  view: Pick<WorkoutView, 'workout' | 'sets'>;
  now: Instant;
  showTime: boolean; // the Cierre hides the minutes of a workout from another day (spec 005 AC-9)
}) {
  const summary = workoutSummary(view, now);
  const figures: [string, Figure][] = [
    ...(showTime ? [['Duración', minutesFigure(summary.minutes)] as [string, Figure]] : []),
    ['Series hechas', setsFigure(summary.setsDone)],
    ['Ejercicios', itemsFigure(summary.itemsWithDoneSets, summary.itemCount)],
  ];
  return (
    <dl className={styles.summary}>
      {figures.map(([term, { value, rest }]) => (
        <div key={term} className={styles.figure}>
          <dt className="visually-hidden">{term}</dt>
          <dd>
            <span className={styles.value}>{value}</span> {rest}
          </dd>
        </div>
      ))}
    </dl>
  );
}
