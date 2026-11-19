import { useId } from 'react';
import { Link } from 'react-router';
import type { LocalDate } from '@/shared/kernel';
import { errorMessages } from '../../errors/messages';
import { formatShortDay } from '../../format-date';
import styles from './OtherDays.module.css';

// "Otra sesión de esta semana" (spec 002 AC-7 to AC-11; spec 003 §6.5; spec 005 AC-32): each day
// opens its preview, never starts a session directly. 48 px with a neutral border, so it does not
// compete with the main CTA. A day already done is grey text, not a link; its ✓ is not read.
// Once a session was closed today (spec 005b §6.1, RN-TRN-27), a notice goes under the heading;
// the rows stay links, so the rest of the week can still be looked at.
export function OtherDays({
  days,
  trainedToday = false,
}: {
  days: { date: LocalDate; name: string; done: boolean }[];
  trainedToday?: boolean;
}) {
  const titleId = useId();
  return (
    <section className={styles.others} aria-labelledby={titleId}>
      <h2 id={titleId}>Otra sesión de esta semana</h2>
      {trainedToday && (
        <p className={styles.note}>{errorMessages['training/day-already-trained']}</p>
      )}
      <ul className={styles.list}>
        {days.map((day) => {
          const text = `${formatShortDay(day.date)} · ${day.name}`;
          return (
            <li key={day.date}>
              {day.done ? (
                <span className={styles.done}>
                  {`${text} · hecha `}
                  <span aria-hidden="true">✓</span>
                </span>
              ) : (
                <Link to={`/dia/${day.date}`} className={styles.day}>
                  {text}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
