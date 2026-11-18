import { describe, expect, it } from 'vitest';
import type { ID, Instant, LocalDate } from '@/shared/kernel';
import { exerciseHistory } from '../domain/history';
import type { WorkoutState, WorkoutStatus } from '../domain/types';

// RN-TRN-08 holds on its own, even if a repository returns more than completed workouts.

const id = (s: string) => s as ID;

const state = (key: string, status: WorkoutStatus): WorkoutState => ({
  workout: {
    id: id(key),
    templateId: id('tpl'),
    name: 'Full body A',
    programWeek: 1,
    date: '2026-11-09' as LocalDate,
    plannedFor: '2026-11-09' as LocalDate,
    startedAt: '2026-11-09T09:00:00-06:00' as Instant,
    status,
    items: [
      {
        exerciseId: id('prensa'),
        options: [id('prensa')],
        order: 1,
        plannedSets: 1,
        maxSets: 1,
        repRange: [8, 12],
        targetRir: [3, 4],
      },
    ],
  },
  sets: [
    {
      id: id(`${key}-1`),
      workoutId: id(key),
      exerciseId: id('prensa'),
      setNumber: 1,
      weightKg: 60,
      reps: 10,
      rir: 2,
      done: true,
      isExtra: false,
    },
  ],
});

describe('exerciseHistory', () => {
  it('RN-TRN-08: ignora workouts in_progress y discarded aunque tengan series hechas', () => {
    const states = [state('a', 'in_progress'), state('b', 'discarded'), state('c', 'completed')];
    expect(exerciseHistory(states, id('prensa')).map((s) => s.workoutId)).toEqual(['c']);
  });
});
