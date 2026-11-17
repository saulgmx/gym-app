import { err, ok, type Result } from '@/shared/kernel';
import type { PlanError, PlanErrorCode, PlanSeed } from './types';

// Seed rules that cross data (docs/modules/plan.md RN-PLN-07, 11, 15, 19). The shape and range
// of each value is checked before, by the Zod schema (RN-PLN-24, ADR-0012). Pure: no I/O.

type Check = (seed: PlanSeed) => PlanError | undefined;

const fail = (
  code: PlanErrorCode,
  message: string,
  details: Record<string, unknown>,
): PlanError => ({
  code,
  message,
  details,
});
const invalid = (message: string, details: Record<string, unknown>) =>
  fail('plan/invalid-seed', message, details);

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

// RN-PLN-07: no high-risk exercise anywhere in the seed. Templates can only use catalog
// exercises (otherwise (a) fails), so checking the catalog covers mains and alternatives.
const noHighRisk: Check = ({ exercises }) => {
  const high = exercises.find((e) => e.lumbarRisk === 'high');
  return (
    high && fail('plan/high-risk-exercise', 'High-risk exercise in seed', { exerciseId: high.id })
  );
};

// (a) Every referenced ID exists.
const references: Check = ({ exercises, blocks, templates }) => {
  const exerciseIds = new Set(exercises.map((e) => e.id));
  const blockIds = new Set(blocks.map((b) => b.id));
  const templateIds = new Set(templates.map((t) => t.id));

  for (const template of templates) {
    if (!blockIds.has(template.blockId)) {
      return invalid('Template references a missing block', {
        templateId: template.id,
        blockId: template.blockId,
      });
    }
    for (const item of template.items) {
      for (const exerciseId of [item.exerciseId, ...(item.alternatives ?? [])]) {
        if (!exerciseIds.has(exerciseId)) {
          return invalid('Template references a missing exercise', {
            templateId: template.id,
            exerciseId,
          });
        }
      }
    }
  }
  for (const block of blocks) {
    for (const entry of block.schedule) {
      if (entry.kind === 'workout' && !templateIds.has(entry.templateId)) {
        return invalid('Schedule references a missing template', {
          blockId: block.id,
          templateId: entry.templateId,
        });
      }
    }
  }
  return undefined;
};

// (b) Blocks cover weeks 1..totalWeeks with no gaps or overlaps (RN-PLN-02).
const weeks: Check = ({ program, blocks }) => {
  let nextWeek = 1;
  for (const block of [...blocks].sort((a, b) => a.startWeek - b.startWeek)) {
    if (block.startWeek !== nextWeek) {
      return invalid('Blocks leave a gap or overlap', {
        blockId: block.id,
        expectedStartWeek: nextWeek,
      });
    }
    nextWeek = block.endWeek + 1;
  }
  if (nextWeek !== program.totalWeeks + 1) {
    return invalid('Blocks do not end at totalWeeks', {
      lastWeek: nextWeek - 1,
      totalWeeks: program.totalWeeks,
    });
  }
  return undefined;
};

// (c) Each weekday has one entry without parity, or exactly one odd and one even (RN-PLN-03).
const schedule: Check = ({ blocks }) => {
  for (const block of blocks) {
    for (const weekday of WEEKDAYS) {
      const parities = block.schedule
        .filter((e) => e.weekday === weekday)
        .map((e) => (e.kind === 'workout' ? e.weekParity : undefined));
      const single = parities.length === 1 && parities[0] === undefined;
      const pair = parities.length === 2 && parities.includes('odd') && parities.includes('even');
      if (!single && !pair) {
        return invalid('Weekday needs one entry, or one odd and one even', {
          blockId: block.id,
          weekday,
        });
      }
    }
  }
  return undefined;
};

// (d) RN-PLN-11: alternatives differ from the main exercise, do not repeat and share its metric.
const alternatives: Check = ({ exercises, templates }) => {
  const metricOf = new Map(exercises.map((e) => [e.id, e.metric]));
  for (const template of templates) {
    for (const item of template.items) {
      const alts = item.alternatives ?? [];
      const details = { templateId: template.id, exerciseId: item.exerciseId };
      if (alts.includes(item.exerciseId))
        return invalid('Alternative equals the main exercise', details);
      if (new Set(alts).size !== alts.length) return invalid('Repeated alternative', details);
      const other = alts.find((alt) => metricOf.get(alt) !== metricOf.get(item.exerciseId));
      if (other) {
        return invalid('Alternative has a different metric', { ...details, alternativeId: other });
      }
    }
  }
  return undefined;
};

// (e) IDs are unique inside each table.
const uniqueIds: Check = ({ exercises, blocks, templates }) => {
  for (const [table, rows] of [
    ['exercises', exercises],
    ['blocks', blocks],
    ['templates', templates],
  ] as const) {
    const seen = new Set<string>();
    for (const { id } of rows) {
      if (seen.has(id)) return invalid('Duplicate ID', { table, id });
      seen.add(id);
    }
  }
  return undefined;
};

// (f) Blocks belong to the program, and blockIds lists exactly them ordered by startWeek.
const programBlocks: Check = ({ program, blocks }) => {
  const foreign = blocks.find((b) => b.programId !== program.id);
  if (foreign) return invalid('Block belongs to another program', { blockId: foreign.id });

  const expected = [...blocks].sort((a, b) => a.startWeek - b.startWeek).map((b) => b.id);
  const matches =
    expected.length === program.blockIds.length &&
    expected.every((id, i) => program.blockIds[i] === id);
  return matches
    ? undefined
    : invalid('program.blockIds must list the blocks by startWeek', {
        blockIds: program.blockIds,
        expected,
      });
};

// (g) weekRir and weekFactors only use weeks of their own block.
const weekKeys: Check = ({ blocks }) => {
  for (const block of blocks) {
    const keys = [...Object.keys(block.weekRir ?? {}), ...Object.keys(block.weekFactors)].map(
      Number,
    );
    const outside = keys.find((week) => week < block.startWeek || week > block.endWeek);
    if (outside !== undefined) {
      return invalid('Week key outside its block', { blockId: block.id, week: outside });
    }
  }
  return undefined;
};

// (h) order is unique inside each template (RN-PLN-17).
const uniqueOrder: Check = ({ templates }) => {
  for (const template of templates) {
    const orders = template.items.map((i) => i.order);
    if (new Set(orders).size !== orders.length) {
      return invalid('Repeated order in template', { templateId: template.id });
    }
  }
  return undefined;
};

// RN-PLN-19: safety first, then (a) to (h).
const CHECKS: Check[] = [
  noHighRisk,
  references,
  weeks,
  schedule,
  alternatives,
  uniqueIds,
  programBlocks,
  weekKeys,
  uniqueOrder,
];

export function validateSeed(seed: PlanSeed): Result<void, PlanError> {
  for (const check of CHECKS) {
    const error = check(seed);
    if (error) return err(error);
  }
  return ok(undefined);
}
