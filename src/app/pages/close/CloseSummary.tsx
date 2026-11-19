import { workoutSummary, type WorkoutView } from '@/modules/training';
import type { Instant } from '@/shared/kernel';
import { itemsFigure, minutesFigure, setsFigure, type Figure } from './format';
import styles from './close.module.css';

// The three figures of the Cierre (spec 005 §6.1, AC-7 to AC-9; RN-TRN-25). `now` and `showTime`
// are fixed when the page opens; sets and exercises follow the live view (spec §7).
export function CloseSummary({
  view,
  now,
  showTime,
}: {
  view: WorkoutView;
  now: Instant;
  showTime: boolean; // the workout is from today (AC-9)
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
