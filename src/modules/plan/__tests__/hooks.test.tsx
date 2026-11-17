import 'fake-indexeddb/auto';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { Dexie } from 'dexie';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixedClock, type LocalDate } from '@/shared/kernel';
import {
  createPlan,
  planStores,
  useTodayPlan,
  useWeekPlan,
  type PlanApi,
  type TodayPlan,
} from '..';
import { PROGRAM, TPL_B, valid } from './fixtures/seed';

// Reactive hooks over the real plan module and IndexedDB in memory (RN-PLN-26, spec 001 plan
// §6.4). Fixture program: weeks 1-2 from Monday 2026-11-16; Monday A/B, Tuesday cardio,
// Wednesday Full body B, rest of the week rest (dates checked with Node).

const date = (s: string) => s as LocalDate;
const TUESDAY = date('2026-11-17');
const WEDNESDAY = date('2026-11-18');

let db: Dexie;
let plan: PlanApi;

function openPlan() {
  db = new Dexie(crypto.randomUUID());
  db.version(1).stores(planStores);
  plan = createPlan({ db, clock: fixedClock('2026-11-18T08:00:00-06:00') });
}

beforeEach(async () => {
  openPlan();
  await plan.ensureSeeded(valid());
});

afterEach(async () => {
  vi.restoreAllMocks();
  db.close();
  await Dexie.delete(db.name);
});

const label = (day: TodayPlan | undefined) => {
  if (!day) return undefined;
  if (day.kind === 'workout') return day.template.name;
  return day.kind;
};

describe('useTodayPlan', () => {
  it('devuelve undefined mientras carga y luego el plan del día', async () => {
    const { result } = renderHook(() => useTodayPlan(plan, WEDNESDAY));

    expect(result.current).toBeUndefined();
    await waitFor(() => {
      expect(label(result.current)).toBe('Full body B');
    });
  });

  it('RN-PLN-26: al cambiar la fecha nunca devuelve el plan de la fecha anterior', async () => {
    const seen: [LocalDate, string | undefined][] = [];
    const { result, rerender } = renderHook(
      ({ day }: { day: LocalDate }) => {
        const today = useTodayPlan(plan, day);
        seen.push([day, label(today)]);
        return today;
      },
      { initialProps: { day: WEDNESDAY } },
    );
    await waitFor(() => {
      expect(label(result.current)).toBe('Full body B');
    });

    rerender({ day: TUESDAY });

    await waitFor(() => {
      expect(label(result.current)).toBe('cardio');
    });
    const tuesdayValues = seen.filter(([day]) => day === TUESDAY).map(([, value]) => value);
    expect(tuesdayValues).not.toContain('Full body B');
  });

  it('RN-PLN-26: se actualiza solo al cambiar el programa (startDate)', async () => {
    const { result } = renderHook(() => useTodayPlan(plan, WEDNESDAY));
    await waitFor(() => {
      expect(result.current?.position.status).toBe('active');
    });

    await db.table('programs').update(PROGRAM, { startDate: '2026-11-23' });

    await waitFor(() => {
      expect(result.current?.position.status).toBe('not_started');
    });
  });

  it('RN-PLN-26: se actualiza solo al cambiar una plantilla', async () => {
    const { result } = renderHook(() => useTodayPlan(plan, WEDNESDAY));
    await waitFor(() => {
      expect(label(result.current)).toBe('Full body B');
    });

    await db.table('templates').update(TPL_B, { name: 'Full body B renombrada' });

    await waitFor(() => {
      expect(label(result.current)).toBe('Full body B renombrada');
    });
  });
});

describe('useWeekPlan', () => {
  it('devuelve los 7 días de la semana y se actualiza solo', async () => {
    const { result } = renderHook(() => useWeekPlan(plan, date('2026-11-19')));
    await waitFor(() => {
      expect(result.current?.map(label)).toEqual([
        'Full body A',
        'cardio',
        'Full body B',
        'rest',
        'rest',
        'rest',
        'rest',
      ]);
    });

    await db.table('programs').update(PROGRAM, { startDate: '2026-11-23' });

    await waitFor(() => {
      expect(result.current?.every((d) => d.kind === 'none')).toBe(true);
    });
  });

  it('RN-PLN-26: al cambiar de semana nunca devuelve la semana anterior', async () => {
    const seen: [LocalDate, string | undefined][] = [];
    const { result, rerender } = renderHook(
      ({ weekStart }: { weekStart: LocalDate }) => {
        const week = useWeekPlan(plan, weekStart);
        seen.push([weekStart, label(week?.[0])]);
        return week;
      },
      { initialProps: { weekStart: date('2026-11-16') } },
    );
    await waitFor(() => {
      expect(label(result.current?.[0])).toBe('Full body A');
    });

    // Week 2 is even: Monday is Full body B.
    rerender({ weekStart: date('2026-11-23') });

    await waitFor(() => {
      expect(label(result.current?.[0])).toBe('Full body B');
    });
    const week2Values = seen.filter(([day]) => day === '2026-11-23').map(([, value]) => value);
    expect(week2Values).not.toContain('Full body A');
  });
});

class TestBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    return this.state.error ? <p role="alert">{this.state.error.message}</p> : this.props.children;
  }
}

function Today({ api }: { api: PlanApi }) {
  const today = useTodayPlan(api, WEDNESDAY);
  return <p>{label(today) ?? 'cargando'}</p>;
}

describe('errores', () => {
  it('RN-PLN-26: sin programa, el error se lanza en el render y lo captura el boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs caught errors
    db.close();
    await Dexie.delete(db.name);
    openPlan(); // empty database: queries throw (RN-PLN-22)

    render(
      <TestBoundary>
        <Today api={plan} />
      </TestBoundary>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/RN-PLN-22/);
  });
});
