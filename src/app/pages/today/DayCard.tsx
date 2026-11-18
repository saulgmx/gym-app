import { useId } from 'react';
import { formatRir, plannedSessionSeconds, type TodayPlan } from '@/modules/plan';
import type { LocalDate } from '@/shared/kernel';
import { formatLongDate } from '../../format-date';
import { StartWorkoutButton } from '../StartWorkoutButton';
import { formatSessionSummary } from './format';
import styles from './DayCard.module.css';

// "Tu sesión de hoy" (spec 003 §6.2, AC-1, AC-5, AC-7 to AC-9). One eyebrow for every state of D,
// which also names the region. Rest entries of the seed have no note, so their text lives here.

const REST_TEXT = 'Recupera: dormir y comer bien también es entrenar.';

function Chips({ chips }: { chips: (string | false | null | undefined)[] }) {
  // Each text once: the deload block of the seed is itself named "Descarga".
  const shown = [...new Set(chips.filter((chip): chip is string => Boolean(chip)))];
  if (shown.length === 0) return null;
  // A list, so a screen reader does not run the chips together.
  return (
    <ul className={styles.chips}>
      {shown.map((chip) => (
        <li key={chip} className={styles.chip}>
          {chip}
        </li>
      ))}
    </ul>
  );
}

function outsideMessage(today: TodayPlan): string {
  const { position } = today;
  return position.status === 'not_started'
    ? `El plan empieza el ${formatLongDate(position.startDate)}.`
    : `Terminaste el plan de ${String(position.totalWeeks)} semanas.`;
}

function Body({ today, date }: { today: TodayPlan; date: LocalDate }) {
  const block = today.position.block?.name;
  switch (today.kind) {
    case 'workout': {
      const items = today.plannedItems;
      const [first] = items;
      return (
        <>
          <h2 className={styles.title}>{today.template.name}</h2>
          <p className={styles.summary}>
            {formatSessionSummary(items.length, plannedSessionSeconds(items))}
          </p>
          <Chips
            chips={[
              block,
              first && formatRir(first.targetRir), // the same for every item (RN-PLN-06)
              today.position.isDeloadWeek && 'Descarga',
            ]}
          />
          <StartWorkoutButton date={date} plannedFor={date} />
        </>
      );
    }
    case 'cardio':
      return (
        <>
          <h2 className={styles.title}>Cardio</h2>
          <p className={styles.summary}>{today.note}</p>
          <Chips chips={[block]} />
        </>
      );
    case 'rest':
      return (
        <>
          <h2 className={styles.title}>Descanso</h2>
          <p className={styles.summary}>{REST_TEXT}</p>
          <Chips chips={[block]} />
        </>
      );
    case 'none':
      return <p className={styles.summary}>{outsideMessage(today)}</p>;
  }
}

// Only in state D: with a session in progress, ActiveSessionCard takes its place (§6.3).
export function DayCard({ today, date }: { today: TodayPlan; date: LocalDate }) {
  const eyebrowId = useId();
  return (
    <section className={styles.card} aria-labelledby={eyebrowId}>
      <p id={eyebrowId} className={styles.eyebrow}>
        Tu sesión de hoy
      </p>
      <Body today={today} date={date} />
    </section>
  );
}
