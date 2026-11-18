import { useId } from 'react';
import { Link } from 'react-router';
import type { LocalDate } from '@/shared/kernel';
import { formatShortDay } from '../../format-date';
import styles from './OtherDays.module.css';

// "Otra sesión de esta semana" (spec 002 AC-7 to AC-11; spec 003 §6.5): each day opens its
// preview, never starts a session directly. 48 px with a neutral border, so it does not compete
// with the main CTA.
export function OtherDays({ days }: { days: { date: LocalDate; name: string }[] }) {
  const titleId = useId();
  return (
    <section className={styles.others} aria-labelledby={titleId}>
      <h2 id={titleId}>Otra sesión de esta semana</h2>
      <ul className={styles.list}>
        {days.map((day) => (
          <li key={day.date}>
            <Link to={`/dia/${day.date}`} className={styles.day}>
              {`${formatShortDay(day.date)} · ${day.name}`}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
