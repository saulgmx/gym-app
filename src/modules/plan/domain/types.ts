import type { DomainError, ID, LocalDate, Weekday } from '@/shared/kernel';

// Domain model of the plan module (docs/modules/plan.md §3, contract v1.3).

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';
export type LumbarRisk = 'low' | 'medium' | 'high';
export type Metric = 'weight' | 'reps' | 'time';

export interface Exercise {
  id: ID;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment;
  metric: Metric; // 'weight' on bodyweight lifts is the added load (0 = bodyweight)
  lumbarRisk: LumbarRisk;
  isPrimary: boolean; // main compound, used by the deload rule (phase 4)
  beltRecommended?: boolean;
  cue?: string;
  restSeconds: [number, number];
}

export interface Program {
  id: ID;
  name: string;
  startDate: LocalDate;
  totalWeeks: number;
  blockIds: ID[];
}

export type ScheduleEntry =
  | { weekday: Weekday; kind: 'workout'; templateId: ID; weekParity?: 'odd' | 'even' }
  | { weekday: Weekday; kind: 'cardio'; note: string }
  | { weekday: Weekday; kind: 'rest' };

export interface Block {
  id: ID;
  programId: ID;
  name: string; // display name, e.g. "Bloque 1 · Full body"
  startWeek: number;
  endWeek: number;
  targetRir: [number, number];
  weekRir?: Record<number, [number, number]>; // program week → RIR (RN-PLN-06)
  weekFactors: Record<number, number>; // program week → volume factor; default 1.0
  isDeload: boolean;
  schedule: ScheduleEntry[]; // RN-PLN-03, RN-PLN-12
}

export interface TemplateItem {
  exerciseId: ID; // main exercise
  alternatives?: ID[]; // RN-PLN-11
  order: number;
  sets: [number, number];
  reps: [number, number]; // seconds when the exercise metric is 'time'
  note?: string;
}

export interface SessionTemplate {
  id: ID;
  blockId: ID;
  name: string;
  items: TemplateItem[];
}

// Seed shape: the start date is set by ensureSeeded (RN-PLN-13).
export interface PlanSeed {
  exercises: Exercise[];
  program: Omit<Program, 'startDate'>;
  blocks: Block[];
  templates: SessionTemplate[];
}

// Output values

export interface ProgramPosition {
  status: 'not_started' | 'active' | 'finished';
  startDate: LocalDate; // of the program, also outside it (RN-PLN-01)
  totalWeeks: number;
  week: number | null; // 1..totalWeeks
  block: Block | null;
  isDeloadWeek: boolean;
  volumeFactor: number;
}

export interface PlannedItem {
  exercise: Exercise;
  alternatives: Exercise[]; // resolved, in seed order; [] when there are none (RN-PLN-11)
  order: number;
  plannedSets: number; // after the volume factor (RN-PLN-05)
  repRange: [number, number];
  targetRir: [number, number];
  note?: string;
}

export type TodayPlan =
  | {
      kind: 'workout';
      position: ProgramPosition;
      template: SessionTemplate;
      plannedItems: PlannedItem[];
    }
  | { kind: 'cardio' | 'rest'; position: ProgramPosition; note?: string }
  | { kind: 'none'; position: ProgramPosition }; // outside the program

// Errors (ADR-0010, contract §7)

export type PlanErrorCode =
  | 'plan/invalid-seed'
  | 'plan/high-risk-exercise'
  | 'plan/template-not-found'
  | 'plan/week-out-of-range';

export type PlanError = DomainError<PlanErrorCode>;
