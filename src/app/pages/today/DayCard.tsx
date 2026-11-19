import { useId } from 'react';
import { formatRir, plannedSessionSeconds, type TodayPlan } from '@/modules/plan';
import { workoutSummary, type WorkoutView } from '@/modules/training';
import type { Instant, LocalDate } from '@/shared/kernel';
import { formatLongDate } from '../../format-date';
import { StartWorkoutButton } from '../StartWorkoutButton';
import {
  formatBackChip,
  formatDoneSummary,
  formatSessionSummary,
  formatTrainedToday,
} from './format';
import styles from './DayCard.module.css';

// "Tu sesión de hoy" (spec 003 §6.2, AC-1, AC-5, AC-7 to AC-9; spec 005 AC-34, §6.3). One eyebrow
// for every state of D, which also names the region. Rest entries of the seed have no note, so
// their text lives here. A workout day already done shows "Hecha ✓" and its summary instead of
// the CTA (the DoneDayCard of plan §6.7, kept here so it shares the section and the chips).

const REST_TEXT = 'Recupera: dormir y comer bien también es entrenar.';

interface Chip {
  text: string;
  warn?: boolean; // amber (the back chip from 4)
  mark?: string; // drawn after the text, aria-hidden ("✓")
}

function Chips({ chips }: { chips: (Chip | string | false | null | undefined)[] }) {
  // Each text once: the deload block of the seed is itself named "Descarga".
  const shown = new Map<string, Chip>();
  for (const chip of chips) {
    if (!chip) continue;
    const value = typeof chip === 'string' ? { text: chip } : chip;
    if (!shown.has(value.text)) shown.set(value.text, value);
  }
  if (shown.size === 0) return null;
  // A list, so a screen reader does not run the chips together.
  return (
    <ul className={styles.chips}>
      {[...shown.values()].map(({ text, warn, mark }) => (
        <li key={text} className={styles.chip} data-warn={warn === true || undefined}>
          {text}
          {mark && (
            <>
              {' '}
              <span aria-hidden="true">{mark}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

const backChip = (back: number | null): Chip | null =>
  back === null ? null : { text: formatBackChip(back), warn: back >= 4 };

function outsideMessage(today: TodayPlan): string {
  const { position } = today;
  return position.status === 'not_started'
    ? `El plan empieza el ${formatLongDate(position.startDate)}.`
    : `Terminaste el plan de ${String(position.totalWeeks)} semanas.`;
}

/** What the card needs of a workout day already done (spec 005 AC-34). */
export interface DoneDay {
  view: WorkoutView | null; // null only with broken data: the card then has no summary line
  now: Instant;
}

/** The session already closed today, when it is not today's own (spec 005b §6.1, RN-TRN-27). */
export interface TrainedToday {
  name: string;
  plannedFor: LocalDate;
}

function Body({
  today,
  date,
  back,
  done,
  trained,
}: {
  today: TodayPlan;
  date: LocalDate;
  back: number | null;
  done: DoneDay | null;
  trained: TrainedToday | null;
}) {
  const block = today.position.block?.name;
  switch (today.kind) {
    case 'workout': {
      const items = today.plannedItems;
      const [first] = items;
      const chips = [
        block,
        first && formatRir(first.targetRir), // the same for every item (RN-PLN-06)
        today.position.isDeloadWeek && 'Descarga',
        done && { text: 'Hecha', mark: '✓' },
        backChip(back),
      ];
      if (done) {
        const summary = done.view && workoutSummary(done.view, done.now);
        return (
          <>
            <h2 className={styles.title}>{today.template.name}</h2>
            <Chips chips={chips} />
            {summary && (
              <p className={styles.summary}>
                {formatDoneSummary(summary.minutes, summary.setsDone)}
              </p>
            )}
          </>
        );
      }
      return (
        <>
          <h2 className={styles.title}>{today.template.name}</h2>
          <p className={styles.summary}>
            {formatSessionSummary(items.length, plannedSessionSeconds(items))}
          </p>
          <Chips chips={chips} />
          {trained ? (
            // One closed session per day (RN-TRN-27): the text takes the place of the button.
            <p className={styles.trained}>{formatTrainedToday(trained.name, trained.plannedFor)}</p>
          ) : (
            <StartWorkoutButton date={date} plannedFor={date} />
          )}
        </>
      );
    }
    case 'cardio':
      return (
        <>
          <h2 className={styles.title}>Cardio</h2>
          <p className={styles.summary}>{today.note}</p>
          <Chips chips={[block, backChip(back)]} />
        </>
      );
    case 'rest':
      return (
        <>
          <h2 className={styles.title}>Descanso</h2>
          <p className={styles.summary}>{REST_TEXT}</p>
          <Chips chips={[block, backChip(back)]} />
        </>
      );
    case 'none':
      return <p className={styles.summary}>{outsideMessage(today)}</p>;
  }
}

// Only in state D: with a session in progress, ActiveSessionCard takes its place (§6.3).
export function DayCard({
  today,
  date,
  back = null,
  done = null,
  trained = null,
}: {
  today: TodayPlan;
  date: LocalDate;
  back?: number | null; // level of the latest pain entry, for the "Espalda N/10" chip
  done?: DoneDay | null; // today's workout day is already done
  trained?: TrainedToday | null; // another session was closed today; only a pending workout day uses it
}) {
  const eyebrowId = useId();
  return (
    <section className={styles.card} aria-labelledby={eyebrowId}>
      <p id={eyebrowId} className={styles.eyebrow}>
        Tu sesión de hoy
      </p>
      <Body today={today} date={date} back={back} done={done} trained={trained} />
    </section>
  );
}
