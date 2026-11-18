import { PlanExerciseList, type PlannedItem } from '@/modules/plan';
import styles from './ExerciseDetails.module.css';

// "Ver los N ejercicios" below the day card (spec 003 §6.2, AC-3, AC-4): closed when the page
// opens; sets × reps and the template note, no loads.
export function ExerciseDetails({ items }: { items: PlannedItem[] }) {
  const label =
    items.length === 1 ? 'Ver el ejercicio' : `Ver los ${String(items.length)} ejercicios`;
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>{label}</summary>
      <PlanExerciseList items={items} />
    </details>
  );
}
