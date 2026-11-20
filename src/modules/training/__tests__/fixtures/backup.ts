import type { ID, Instant, LocalDate } from '@/shared/kernel';
import type { SetLog, TrainingBackup, Workout, WorkoutItem } from '../../domain/types';

// Rows for the backup tests (RN-TRN-30), shaped as the app stores them: optional keys are absent,
// never undefined. IDs are fixed UUIDv7 values so the port's schema accepts them.

export const uuid = (n: number) => `0196a000-0000-7000-8000-${String(n).padStart(12, '0')}` as ID;

export const PRENSA = uuid(1);
export const DOMINADAS = uuid(2);
export const JALON = uuid(3);
export const L16 = uuid(100);
export const X17 = uuid(101); // discarded
export const M18 = uuid(102);

const instant = (s: string) => s as Instant;
const date = (s: string) => s as LocalDate;

export const items = (): WorkoutItem[] => [
  {
    exerciseId: PRENSA,
    options: [PRENSA],
    order: 1,
    plannedSets: 2,
    maxSets: 3,
    repRange: [8, 12],
    targetRir: [2, 3],
    note: 'Pies bajos',
  },
  {
    exerciseId: JALON, // the alternative was chosen (RN-TRN-13)
    options: [DOMINADAS, JALON],
    order: 2,
    plannedSets: 2,
    maxSets: 2,
    repRange: [6, 10],
    targetRir: [2, 3],
  },
];

export function workout(id: ID, overrides: Partial<Workout> = {}): Workout {
  return {
    id,
    templateId: uuid(30),
    name: 'Full body A',
    programWeek: 1,
    date: date('2026-11-16'),
    plannedFor: date('2026-11-16'),
    startedAt: instant('2026-11-16T18:00:00-06:00'),
    finishedAt: instant('2026-11-16T18:52:00-06:00'),
    status: 'completed',
    items: items(),
    ...overrides,
  };
}

let next = 1000;
export function set(workoutId: ID, exerciseId: ID, setNumber: number, done: boolean): SetLog {
  next += 1;
  return {
    id: uuid(next),
    workoutId,
    exerciseId,
    setNumber,
    weightKg: done ? 100 : null,
    reps: done ? 10 : null,
    rir: done ? 2 : null,
    done,
    isExtra: false,
    ...(done ? { completedAt: instant('2026-11-16T18:10:00-06:00') } : {}),
  };
}

const sets = (workoutId: ID, exerciseId: ID, total: number, done: number) =>
  Array.from({ length: total }, (_, i) => set(workoutId, exerciseId, i + 1, i < done));

/**
 * Spec 007 §4: L16 completed with 10 done sets, M18 completed with 5 done of 10 (planned for the
 * Friday), and a discarded session on the 17th with 2 done sets that does not count.
 */
export function specBackup(): TrainingBackup {
  const m18 = workout(M18, {
    date: date('2026-11-18'),
    plannedFor: date('2026-11-20'),
    startedAt: instant('2026-11-18T18:00:00-06:00'),
    finishedAt: instant('2026-11-18T18:30:00-06:00'),
    notes: 'Hormigueo al final',
  });
  const x17 = workout(X17, {
    date: date('2026-11-17'),
    plannedFor: date('2026-11-17'),
    startedAt: instant('2026-11-17T18:00:00-06:00'),
    status: 'discarded',
  });
  delete x17.finishedAt; // discarding never sets it (RN-TRN-15)
  return {
    workouts: [workout(L16), x17, m18],
    sets: [
      ...sets(L16, PRENSA, 5, 5),
      ...sets(L16, JALON, 5, 5),
      ...sets(X17, PRENSA, 2, 2),
      ...sets(M18, PRENSA, 5, 3),
      ...sets(M18, JALON, 5, 2),
    ],
  };
}
