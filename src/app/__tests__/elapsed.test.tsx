import { act, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clock, Instant, LocalDate } from '@/shared/kernel';
import { Elapsed } from '../pages/today/Elapsed';

// Elapsed time of the session in progress (spec 003 AC-17, plan §6.5). A manual clock: the test
// moves `now` and advances the fake timers. Seconds computed with Node from Date.parse.

const STARTED = '2026-11-16T18:00:00-06:00' as Instant;

function manualClock(start: string) {
  let now = start;
  const clock: Clock = {
    now: () => now as Instant,
    today: () => now.slice(0, 10) as LocalDate,
  };
  return {
    clock,
    set: (next: string) => {
      now = next;
    },
  };
}

/** Moves the clock and lets the 1 s timer fire. */
function tick(set: (next: string) => void, next: string) {
  set(next);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Elapsed', () => {
  it('AC-17: "18:42" pasa a "18:43" al pasar un segundo', () => {
    const { clock, set } = manualClock('2026-11-16T18:18:42-06:00');
    render(<Elapsed startedAt={STARTED} clock={clock} />);
    expect(screen.getByText('18:42')).toBeInTheDocument();

    tick(set, '2026-11-16T18:18:43-06:00');

    expect(screen.getByText('18:43')).toBeInTheDocument();
    expect(screen.queryByText('18:42')).not.toBeInTheDocument();

    tick(set, '2026-11-16T18:18:44-06:00'); // keeps ticking, not only once

    expect(screen.getByText('18:44')).toBeInTheDocument();
  });

  it('AC-17: con más de una hora, h:mm:ss', () => {
    const { clock } = manualClock('2026-11-16T19:05:12-06:00');
    render(<Elapsed startedAt={STARTED} clock={clock} />);
    expect(screen.getByText('1:05:12')).toBeInTheDocument();
  });

  it('ADR-0009: compara instantes, no texto (el mismo momento en otra zona)', () => {
    const { clock } = manualClock('2026-11-17T00:18:42Z');
    render(<Elapsed startedAt={STARTED} clock={clock} />);
    expect(screen.getByText('18:42')).toBeInTheDocument();
  });

  it('AC-17: si el reloj va hacia atrás, "0:00"', () => {
    const { clock, set } = manualClock('2026-11-16T18:00:05-06:00');
    render(<Elapsed startedAt={STARTED} clock={clock} />);
    expect(screen.getByText('0:05')).toBeInTheDocument();

    tick(set, '2026-11-16T17:59:00-06:00');

    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('plan §6.5: no es región viva', () => {
    const { clock } = manualClock('2026-11-16T18:18:42-06:00');
    render(<Elapsed startedAt={STARTED} clock={clock} className="time" />);
    const element = screen.getByText('18:42');
    expect(element).not.toHaveAttribute('aria-live');
    expect(element).not.toHaveAttribute('role');
    expect(element).toHaveClass('time');
  });

  it('P-6: solo vuelve a dibujar cuando cambia el texto', () => {
    const { clock, set } = manualClock('2026-11-16T18:18:42-06:00');
    const onRender = vi.fn();
    render(
      <Profiler id="elapsed" onRender={onRender}>
        <Elapsed startedAt={STARTED} clock={clock} />
      </Profiler>,
    );
    const afterMount = onRender.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(3000); // the clock did not move: same text
    });
    expect(onRender).toHaveBeenCalledTimes(afterMount);

    tick(set, '2026-11-16T18:18:43-06:00');
    expect(onRender).toHaveBeenCalledTimes(afterMount + 1);
  });

  it('al desmontarse no deja temporizadores', () => {
    const { clock } = manualClock('2026-11-16T18:18:42-06:00');
    const { unmount } = render(<Elapsed startedAt={STARTED} clock={clock} />);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('si cambia startedAt, cuenta desde el nuevo inicio', () => {
    const { clock } = manualClock('2026-11-16T18:18:42-06:00');
    const { rerender } = render(<Elapsed startedAt={STARTED} clock={clock} />);

    rerender(<Elapsed startedAt={'2026-11-16T18:18:00-06:00' as Instant} clock={clock} />);

    expect(screen.getByText('0:42')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
  });
});
