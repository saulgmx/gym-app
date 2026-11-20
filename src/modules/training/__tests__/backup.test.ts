import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/shared/kernel';
import { checkTrainingBackup, describeTrainingBackup } from '../domain/backup';
import type { TrainingBackup } from '../domain/types';
import {
  DOMINADAS,
  JALON,
  L16,
  M18,
  PRENSA,
  X17,
  set,
  specBackup,
  uuid,
  workout,
} from './fixtures/backup';

// RN-TRN-30 (contract v1.31, decision 33): the training backup's own rules and its description.

const date = (s: string) => s as LocalDate;

function failure(data: TrainingBackup) {
  const result = checkTrainingBackup(data);
  if (result.ok) throw new Error('expected a failure');
  return result.error;
}

describe('checkTrainingBackup', () => {
  it('RN-TRN-30: el respaldo de la spec §4 es válido; uno vacío también', () => {
    expect(checkTrainingBackup(specBackup())).toEqual({ ok: true, value: undefined });
    expect(checkTrainingBackup({ workouts: [], sets: [] }).ok).toBe(true);
  });

  it('RN-TRN-30: dos workouts con el mismo id → unique-workout-id con el id', () => {
    const data = specBackup();
    data.workouts.push(workout(L16, { name: 'Copia' }));
    const error = failure(data);
    expect(error.code).toBe('training/invalid-backup');
    expect(error.details).toEqual({ rule: 'unique-workout-id', id: L16 });
    expect(error.message).toMatch(/RN-TRN-30/);
  });

  it('RN-TRN-30: dos series con el mismo id → unique-set-id con el id', () => {
    const data = specBackup();
    const first = data.sets[0];
    if (!first) throw new Error('fixture');
    data.sets.push({ ...first, setNumber: 9 });
    expect(failure(data).details).toEqual({ rule: 'unique-set-id', id: first.id });
  });

  it('RN-TRN-30: una serie de un workout que no está → set-without-workout', () => {
    const data = specBackup();
    const orphan = set(uuid(555), PRENSA, 1, true);
    data.sets.push(orphan);
    expect(failure(data).details).toEqual({
      rule: 'set-without-workout',
      setId: orphan.id,
      workoutId: uuid(555),
    });
  });

  it('RN-TRN-01: dos workouts in_progress → one-active con los dos ids', () => {
    const data = specBackup();
    const a = uuid(200);
    const b = uuid(201);
    data.workouts.push(
      workout(a, { status: 'in_progress' }),
      workout(b, { status: 'in_progress' }),
    );
    expect(failure(data).details).toEqual({ rule: 'one-active', workoutIds: [a, b] });
  });

  it('RN-TRN-01: un solo in_progress es válido', () => {
    const data = specBackup();
    data.workouts.push(workout(uuid(200), { status: 'in_progress' }));
    expect(checkTrainingBackup(data).ok).toBe(true);
  });

  it('RN-TRN-30: con varias reglas rotas sale la primera en el orden del contrato', () => {
    const data = specBackup();
    data.workouts.push(workout(uuid(200), { status: 'in_progress' }));
    data.workouts.push(workout(uuid(201), { status: 'in_progress' }));
    data.sets.push(set(uuid(555), PRENSA, 1, true));
    expect(failure(data).details).toMatchObject({ rule: 'set-without-workout' });

    const first = data.sets[0];
    if (!first) throw new Error('fixture');
    data.sets.push({ ...first });
    expect(failure(data).details).toMatchObject({ rule: 'unique-set-id' });

    data.workouts.push(workout(L16));
    expect(failure(data).details).toMatchObject({ rule: 'unique-workout-id' });
  });

  it('RN-DAT-12: tolera dos completed el mismo día, sin finishedAt, done sin completedAt, números de serie repetidos y notas largas (decisión 33 (b), (c))', () => {
    const data = specBackup();
    const sameDay = workout(uuid(300), { notes: 'x'.repeat(2000) });
    delete sameDay.finishedAt;
    data.workouts.push(sameDay);
    const noTime = set(L16, PRENSA, 1, true);
    delete noTime.completedAt;
    data.sets.push(noTime); // also setNumber 1 again for Prensa in L16
    expect(checkTrainingBackup(data).ok).toBe(true);
  });
});

describe('describeTrainingBackup', () => {
  it('RN-DAT-13: las cifras de la spec §4 (2 sesiones, 15 series, 16-18 nov; la descartada no cuenta)', () => {
    expect(describeTrainingBackup(specBackup()).facts).toEqual({
      completedWorkouts: 2,
      doneSets: 15,
      dateRange: { from: '2026-11-16', to: '2026-11-18' },
      hasActiveWorkout: false,
    });
  });

  it('RN-DAT-13: el rango usa date, no plannedFor (M18 es la sesión del viernes 20)', () => {
    const { facts } = describeTrainingBackup(specBackup());
    expect(facts.dateRange?.to).toBe('2026-11-18');
  });

  it('RN-DAT-13: el rango no depende del orden de los workouts', () => {
    const data = specBackup();
    data.workouts.reverse();
    expect(describeTrainingBackup(data).facts.dateRange).toEqual({
      from: '2026-11-16',
      to: '2026-11-18',
    });
  });

  it('RN-DAT-13: las series no hechas y las de workouts no completed no cuentan', () => {
    const data = specBackup();
    data.workouts.push(workout(uuid(200), { status: 'in_progress', date: date('2026-11-19') }));
    data.sets.push(set(uuid(200), PRENSA, 1, true), set(L16, PRENSA, 6, false));
    expect(describeTrainingBackup(data).facts).toEqual({
      completedWorkouts: 2,
      doneSets: 15,
      dateRange: { from: '2026-11-16', to: '2026-11-18' },
      hasActiveWorkout: true,
    });
  });

  it('RN-DAT-13: sin completed → 0, rango null', () => {
    expect(describeTrainingBackup({ workouts: [], sets: [] }).facts).toEqual({
      completedWorkouts: 0,
      doneSets: 0,
      dateRange: null,
      hasActiveWorkout: false,
    });
  });

  it('RN-DAT-11: ofrece los workouts, también el descartado', () => {
    expect(describeTrainingBackup(specBackup()).provides).toEqual({ workout: [L16, X17, M18] });
  });

  it('RN-DAT-11 (decisión 33 (e)): requiere los ejercicios sin repetir, ítems y options primero y luego las series', () => {
    const data = specBackup();
    const odd = uuid(9);
    data.sets.push(set(L16, odd, 1, false)); // only in a set
    expect(describeTrainingBackup(data).requires).toEqual({
      exercise: [PRENSA, JALON, DOMINADAS, odd],
    });
  });
});
