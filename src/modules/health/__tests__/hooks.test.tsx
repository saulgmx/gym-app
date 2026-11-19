import 'fake-indexeddb/auto';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { Dexie } from 'dexie';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sequentialIds, type Clock, type ID, type Instant, type LocalDate } from '@/shared/kernel';
import { createHealth, healthStores, usePainSummary, type HealthApi } from '..';

// usePainSummary over the real health module and IndexedDB in memory (RN-HLT-19, contract v1.7).

const id = (s: string) => s as ID;
const date = (s: string) => s as LocalDate;

let db: Dexie;
let health: HealthApi;
let now = '2026-11-16T19:00:00-06:00';
const clock: Clock = { now: () => now as Instant, today: () => now.slice(0, 10) as LocalDate };

beforeEach(() => {
  now = '2026-11-16T19:00:00-06:00';
  db = new Dexie(crypto.randomUUID());
  db.version(1).stores(healthStores);
  health = createHealth({ db, clock, ids: sequentialIds('pain') });
});

afterEach(async () => {
  vi.restoreAllMocks();
  db.close();
  await Dexie.delete(db.name);
});

async function record(workoutId: string, level: number, instant: string) {
  now = instant;
  const result = await health.recordPain(id(workoutId), {
    level,
    redFlags: [],
    date: date(instant.slice(0, 10)),
  });
  if (!result.ok) throw new Error(result.error.code);
}

describe('usePainSummary', () => {
  it('RN-HLT-19: undefined en el primer render y luego el resumen vacío, nunca null', async () => {
    const { result } = renderHook(() => usePainSummary(health));
    expect(result.current).toBeUndefined();

    await waitFor(() => {
      expect(result.current).toEqual({
        latest: null,
        latestAssessment: null,
        persistentAlert: null,
        notice: null,
        threshold: 3,
      });
    });
  });

  it('RN-HLT-19: se actualiza solo al registrar dolor', async () => {
    const { result } = renderHook(() => usePainSummary(health));
    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    await record('w1', 5, '2026-11-16T19:00:00-06:00');

    await waitFor(() => {
      expect(result.current?.latest).toMatchObject({ workoutId: 'w1', level: 5 });
    });
    expect(result.current?.notice?.cause).toBe('attention');
  });

  it('RN-HLT-19: se actualiza al reemplazar el dolor de un workout', async () => {
    await record('w1', 5, '2026-11-16T19:00:00-06:00');
    const { result } = renderHook(() => usePainSummary(health));
    await waitFor(() => {
      expect(result.current?.latest?.level).toBe(5);
    });

    await record('w1', 2, '2026-11-16T19:05:00-06:00');

    await waitFor(() => {
      expect(result.current?.latest).toMatchObject({ workoutId: 'w1', level: 2 });
    });
    expect(result.current?.notice).toBeNull();
  });

  it('RN-HLT-19: con otra instancia de health, consulta la nueva (dependencias [health])', async () => {
    await record('w1', 5, '2026-11-16T19:00:00-06:00');
    const otherDb = new Dexie(crypto.randomUUID());
    otherDb.version(1).stores(healthStores);
    const other = createHealth({ db: otherDb, clock, ids: sequentialIds('other') });
    try {
      const { result, rerender } = renderHook(({ api }) => usePainSummary(api), {
        initialProps: { api: health },
      });
      await waitFor(() => {
        expect(result.current?.latest?.level).toBe(5);
      });

      rerender({ api: other });

      await waitFor(() => {
        expect(result.current?.latest).toBeNull();
      });
    } finally {
      otherDb.close();
      await Dexie.delete(otherDb.name);
    }
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

function Back() {
  const summary = usePainSummary(health);
  if (summary === undefined) return <p>cargando</p>;
  return <p>{summary.latest ? `${String(summary.latest.level)}/10` : 'sin dolor'}</p>;
}

describe('errores', () => {
  it('RN-HLT-19: un error de la consulta se lanza en el render y lo captura el boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs caught errors
    // A read that throws. Not a closed database: Dexie's liveQuery waits silently for it to open.
    await record('w1', 4, '2026-11-16T19:00:00-06:00');
    db.table('painEntries').hook('reading', () => {
      throw new Error('disk failure');
    });

    render(
      <TestBoundary>
        <Back />
      </TestBoundary>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('disk failure');
  });
});
