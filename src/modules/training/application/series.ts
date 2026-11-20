import type { ID, SeriesRow } from '@/shared/kernel';
import { seriesRows } from '../domain/series';
import type { PlanReader, TrainingRepository } from './ports';

// The read behind dataPort.seriesRows() (RN-TRN-31, spec 008, contract v1.34). Completed workouts
// come from one read transaction; plan is asked once, outside it (plan §6.3), only for the
// exercises of the sets that become rows (c). Rejections pass through unchanged (j).

export function createSeriesReader(deps: {
  repository: Pick<TrainingRepository, 'findCompletedStates'>;
  plan: Pick<PlanReader, 'getExercises'>;
}): () => Promise<SeriesRow[]> {
  return async () => {
    const states = await deps.repository.findCompletedStates();
    const ids = new Set<ID>();
    // findCompletedStates returns only completed workouts, so the done sets are the rows' sets.
    for (const { sets } of states) for (const set of sets) if (set.done) ids.add(set.exerciseId);
    if (ids.size === 0) return [];
    // plan's Exercise carries id, name and metric: it is a SeriesExercise as is (case (f)).
    const exercises = await deps.plan.getExercises([...ids]);
    return seriesRows(states, exercises);
  };
}
