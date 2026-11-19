import {
  addDays,
  daysBetween,
  startOfIsoWeek,
  weekdayOf,
  type ID,
  type LocalDate,
} from '@/shared/kernel';
import type {
  Block,
  Exercise,
  PlannedItem,
  Program,
  ProgramPosition,
  SessionTemplate,
  TodayPlan,
} from './types';

// Calendar rules of the plan module (docs/modules/plan.md §6). Pure: data and date come in.

export interface PlanSnapshot {
  program: Program;
  blocks: Block[];
  templates: SessionTemplate[];
  exercises: Exercise[];
}

const DELOAD_FACTOR = 0.5; // RN-PLN-04
const DELOAD_RIR = 4; // RN-PLN-06

type Located =
  | { position: ProgramPosition; block: null; week: null }
  | { position: ProgramPosition; block: Block; week: number };

function outside(program: Program, status: 'not_started' | 'finished'): Located {
  const { startDate, totalWeeks } = program;
  return {
    position: {
      status,
      startDate,
      totalWeeks,
      week: null,
      block: null,
      isDeloadWeek: false,
      volumeFactor: 1,
    },
    block: null,
    week: null,
  };
}

// RN-PLN-28: the block whose range holds the week, or null outside the program. RN-PLN-15 (b)
// rules out overlaps, so the order of the list does not matter.
export function blockOfWeek(blocks: Block[], week: number): Block | null {
  return blocks.find((b) => b.startWeek <= week && week <= b.endWeek) ?? null;
}

// RN-PLN-01, 02, 04
function locate({ program, blocks }: PlanSnapshot, date: LocalDate): Located {
  const days = daysBetween(program.startDate, date);
  if (days < 0) return outside(program, 'not_started');

  const week = Math.floor(days / 7) + 1;
  if (week > program.totalWeeks) return outside(program, 'finished');

  const block = blockOfWeek(blocks, week);
  if (!block) throw new Error(`No block covers week ${String(week)} (RN-PLN-02)`);

  const volumeFactor = block.isDeload ? DELOAD_FACTOR : (block.weekFactors[week] ?? 1);
  return {
    position: {
      status: 'active',
      startDate: program.startDate,
      totalWeeks: program.totalWeeks,
      week,
      block,
      isDeloadWeek: block.isDeload,
      volumeFactor,
    },
    block,
    week,
  };
}

export function getPosition(snapshot: PlanSnapshot, date: LocalDate): ProgramPosition {
  return locate(snapshot, date).position;
}

export function getDayPlan(snapshot: PlanSnapshot, date: LocalDate): TodayPlan {
  const { position, block, week } = locate(snapshot, date);
  if (!block) return { kind: 'none', position };

  // RN-PLN-03: parity of the week inside the block, not inside the program.
  const parity = (week - block.startWeek) % 2 === 0 ? 'odd' : 'even';
  const weekday = weekdayOf(date);
  const entry = block.schedule.find(
    (e) =>
      e.weekday === weekday &&
      (e.kind !== 'workout' || e.weekParity === undefined || e.weekParity === parity),
  );
  if (!entry) throw new Error(`No schedule entry for ${date} in ${block.name} (RN-PLN-16)`);

  // RN-PLN-18
  if (entry.kind === 'cardio') return { kind: 'cardio', position, note: entry.note };
  if (entry.kind === 'rest') return { kind: 'rest', position };

  // RN-PLN-12: the template may belong to any block of the program.
  const template = snapshot.templates.find((t) => t.id === entry.templateId);
  if (!template) throw new Error(`Template ${entry.templateId} not found (RN-PLN-16)`);

  const targetRir: [number, number] = block.isDeload
    ? [DELOAD_RIR, DELOAD_RIR]
    : (block.weekRir?.[week] ?? block.targetRir);

  const exerciseById = (exerciseId: ID): Exercise => {
    const exercise = snapshot.exercises.find((e) => e.id === exerciseId);
    if (!exercise) throw new Error(`Exercise ${exerciseId} not found (RN-PLN-16)`);
    return exercise;
  };

  const plannedItems = [...template.items]
    .sort((a, b) => a.order - b.order) // RN-PLN-17
    .map((item): PlannedItem => ({
      exercise: exerciseById(item.exerciseId),
      alternatives: (item.alternatives ?? []).map(exerciseById), // RN-PLN-11
      order: item.order,
      // RN-PLN-05: minimum of the range; Math.round rounds .5 up.
      plannedSets: Math.max(1, Math.round(item.sets[0] * position.volumeFactor)),
      repRange: item.reps,
      targetRir,
      ...(item.note === undefined ? {} : { note: item.note }),
    }));

  return { kind: 'workout', position, template, plannedItems };
}

// RN-PLN-10: Monday to Sunday of the week that contains `date`.
export function getWeekPlan(snapshot: PlanSnapshot, date: LocalDate): TodayPlan[] {
  const monday = startOfIsoWeek(date);
  return Array.from({ length: 7 }, (_, i) => getDayPlan(snapshot, addDays(monday, i)));
}
