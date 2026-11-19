import { Suspense, use, useId, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { formatRedFlags, usePainForWorkouts, type PainEntry } from '@/modules/health';
import {
  formatDoneSet,
  historyDetail,
  useWorkoutView,
  type HistoryItem,
  type WorkoutView,
} from '@/modules/training';
import type { ID } from '@/shared/kernel';
import { useApp } from '../../context';
import { formatLongDateTitle, formatWeekday } from '../../format-date';
import { SummaryFigures } from '../SummaryFigures';
import {
  formatDetailTitle,
  formatRedFlagsLine,
  formatReplaces,
  formatWeekTitle,
  HISTORY_TEXTS,
} from './texts';
import pages from '../pages.module.css';
import styles from './detail.module.css';

// The detail of one session (spec 006 §6.2, AC-14 to AC-32; plan §6.8). Read only: no control
// changes anything (RN-TRN-07). Nothing shows until the view and its pain entry answer.

const LIST_TITLE = 'Historial · Gym';

export function HistoryDetailPage() {
  return (
    <Suspense fallback={<title>{LIST_TITLE}</title>}>
      <DetailContent />
    </Suspense>
  );
}

/** Where "Volver" goes: the origin the navigation passed, if it is one of the app's (AC-27 to
 *  AC-29). `state` comes as `any` from React Router, so it is read as unknown. */
function backTo(state: unknown): '/' | '/historial' {
  const from = (state as { from?: unknown } | null)?.from;
  return from === '/' ? '/' : '/historial';
}

function DetailContent() {
  const { training, health, ready } = useApp();
  use(ready);
  const workoutId = (useParams().workoutId ?? '') as ID;
  const back = backTo(useLocation().state as unknown);
  const view = useWorkoutView(training, workoutId);
  const pain = usePainForWorkouts(health, [workoutId]);
  if (view === undefined || pain === undefined) return <title>{LIST_TITLE}</title>;
  const items = view && historyDetail(view);
  if (!view || !items) {
    return (
      <>
        <title>{LIST_TITLE}</title>
        <h1>{HISTORY_TEXTS.title}</h1>
        <p className={pages.empty}>{HISTORY_TEXTS.notInHistory}</p>
        <Link to="/historial" className={pages.backLink}>
          {HISTORY_TEXTS.seeHistory}
        </Link>
      </>
    );
  }
  return <Detail view={view} items={items} pain={pain.get(workoutId)} back={back} />;
}

function Detail({
  view,
  items,
  pain,
  back,
}: {
  view: WorkoutView;
  items: HistoryItem[];
  pain: PainEntry | undefined;
  back: '/' | '/historial';
}) {
  const { workout } = view;
  const week =
    workout.programWeek === null ? HISTORY_TEXTS.outside : formatWeekTitle(workout.programWeek);
  const otherDay =
    workout.plannedFor === workout.date ? '' : ` · sesión del ${formatWeekday(workout.plannedFor)}`;
  // RN-TRN-17: the view already threw if the plan lacked one of these exercises.
  const exercise = (id: ID) => {
    const found = view.exercises[id];
    if (!found) throw new Error(`Exercise ${id} missing from the view (RN-TRN-17)`);
    return found;
  };
  return (
    <>
      <title>{formatDetailTitle(workout.name)}</title>
      <div className={styles.header}>
        <Link to={back} aria-label={HISTORY_TEXTS.back} className={styles.back}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.arrow}>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1>{workout.name}</h1>
      </div>
      <p className={styles.subtitle}>
        {`${formatLongDateTitle(workout.date)} · ${week}${otherDay}`}
      </p>
      <SummaryFigures view={view} now={workout.finishedAt ?? workout.startedAt} showTime />
      <Section title={HISTORY_TEXTS.pain}>
        {pain ? (
          <>
            <p className={styles.level} data-warn={pain.level >= 4 ? '' : undefined}>
              {`${String(pain.level)}/10`}
            </p>
            {pain.redFlags.length > 0 && <p>{formatRedFlagsLine(formatRedFlags(pain.redFlags))}</p>}
          </>
        ) : (
          <p className={styles.muted}>{HISTORY_TEXTS.noPain}</p>
        )}
      </Section>
      <Section title={HISTORY_TEXTS.exercises}>
        <ul className={styles.exercises}>
          {items.map((item) => {
            const { name, metric } = exercise(item.exerciseId);
            const empty = item.sets.length === 0;
            return (
              <li key={item.exerciseId} className={styles.exercise}>
                <h3 data-empty={empty ? '' : undefined}>{name}</h3>
                {item.replaces && (
                  <p className={styles.muted}>{formatReplaces(exercise(item.replaces).name)}</p>
                )}
                {empty ? (
                  <p className={styles.muted}>{HISTORY_TEXTS.noSets}</p>
                ) : (
                  <ol className={styles.sets}>
                    {item.sets.map((set) => (
                      <li key={set.id}>
                        {`${String(set.setNumber)} · ${formatDoneSet(set, metric)}${
                          set.isExtra ? ` · ${HISTORY_TEXTS.extra}` : ''
                        }`}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
      {workout.notes && (
        <Section title={HISTORY_TEXTS.notes}>
          <p className={styles.notes}>{workout.notes}</p>
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </section>
  );
}
