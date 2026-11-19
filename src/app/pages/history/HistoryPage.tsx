import { Suspense, use, useId } from 'react';
import { usePainForWorkouts, type PainEntry } from '@/modules/health';
import { blockOfWeek, useBlocks, type Block } from '@/modules/plan';
import { useWorkoutHistory } from '@/modules/training';
import type { ID } from '@/shared/kernel';
import { useApp } from '../../context';
import { formatWeekRange } from '../../format-date';
import { groupByWeek, type WeekGroup } from './group';
import { HistoryRow } from './HistoryRow';
import { formatWeekTitle, HISTORY_TEXTS } from './texts';
import pages from '../pages.module.css';
import styles from './history.module.css';

// The history list (spec 006 §6.1, plan §6.7): completed sessions grouped by week, latest first.
// Nothing shows until the three queries answer, so the empty text never flashes while loading
// (spec §6.4). A rejected `ready` or query goes to the route's ErrorFallback.
export function HistoryPage() {
  return (
    <>
      <title>Historial · Gym</title>
      <h1>{HISTORY_TEXTS.title}</h1>
      <Suspense fallback={null}>
        <HistoryContent />
      </Suspense>
    </>
  );
}

function HistoryContent() {
  const { plan, training, health, ready } = useApp();
  use(ready);
  const history = useWorkoutHistory(training);
  const pain = usePainForWorkouts(health, history?.map((e) => e.workout.id) ?? []);
  const blocks = useBlocks(plan);
  if (!history || !pain || !blocks) return null;
  if (history.length === 0) return <p className={pages.empty}>{HISTORY_TEXTS.empty}</p>;
  return groupByWeek(history).map((group) => (
    <WeekSection key={group.weekStart} group={group} blocks={blocks} pain={pain} />
  ));
}

function WeekSection({
  group,
  blocks,
  pain,
}: {
  group: WeekGroup;
  blocks: Block[];
  pain: Map<ID, PainEntry>;
}) {
  const titleId = useId();
  const { programWeek, weekStart, entries } = group;
  // Without a block (outside the program, or a week no block covers) only the range shows.
  const block = programWeek === null ? null : blockOfWeek(blocks, programWeek);
  const subtitle = [block?.name, formatWeekRange(weekStart)].filter(Boolean).join(' · ');
  return (
    <section className={styles.week} aria-labelledby={titleId}>
      <h2 id={titleId}>
        {programWeek === null ? HISTORY_TEXTS.outside : formatWeekTitle(programWeek)}
      </h2>
      <p className={styles.subtitle}>{subtitle}</p>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <HistoryRow key={entry.workout.id} entry={entry} pain={pain.get(entry.workout.id)} />
        ))}
      </ul>
    </section>
  );
}
