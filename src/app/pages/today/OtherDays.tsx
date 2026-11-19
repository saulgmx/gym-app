import { useId } from 'react';
import { Link } from 'react-router';
import type { ID, LocalDate } from '@/shared/kernel';
import { errorMessages } from '../../errors/messages';
import { formatShortDay } from '../../format-date';
import styles from './OtherDays.module.css';

// "Otra sesión de esta semana" (spec 002 AC-7 to AC-11; spec 003 §6.5; spec 005 AC-32): each day
// opens its preview, never starts a session directly. 48 px with a neutral border, so it does not
// compete with the main CTA. A day already done stays grey and, since spec 006 AC-34, links to its
// session detail from "Hoy"; its ✓ is not read.
// Once a session was closed today (spec 005b §6.1, RN-TRN-27), a notice goes under the heading;
// the rows stay links, so the rest of the week can still be looked at.
export function OtherDays({
  days,
  trainedToday = false,
}: {
  days: { date: LocalDate; name: string; doneId: ID | null }[]; // doneId: its completed workout
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
              {day.doneId ? (
                <Link to={`/historial/${day.doneId}`} state={{ from: '/' }} className={styles.done}>
                  {`${text} · hecha `}
                  <span aria-hidden="true">✓</span>
                </Link>
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
