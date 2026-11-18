import { useEffect, useState } from 'react';
import type { Clock, Instant } from '@/shared/kernel';
import { formatElapsed } from '../format-time';

// Time since the session started, in "Hoy" and in the session header (spec 003 AC-17, plan
// §6.5; spec 004 AC-2). The only component with a 1 s timer: the state holds the formatted
// text, so React re-renders this span only when the text changes, never what is around it (P-6). Each tick reads clock.now() again, so a throttled
// timer in the background never drifts. Instants are compared with Date.parse, never as text
// (ADR-0009). Not a live region: a screen reader would announce it every second.

function elapsedText(startedAt: Instant, clock: Clock): string {
  return formatElapsed((Date.parse(clock.now()) - Date.parse(startedAt)) / 1000);
}

export function Elapsed({
  startedAt,
  clock,
  className,
}: {
  startedAt: Instant;
  clock: Clock;
  className?: string;
}) {
  const [shown, setShown] = useState(() => ({ startedAt, text: elapsedText(startedAt, clock) }));
  // A new start (another session) resets the text during render, as React recommends for a
  // prop change, instead of a synchronous setState inside the effect.
  if (shown.startedAt !== startedAt) setShown({ startedAt, text: elapsedText(startedAt, clock) });

  useEffect(() => {
    const timer = setInterval(() => {
      // Same object when the text did not change: React skips the render (P-6).
      setShown((previous) => {
        const text = elapsedText(startedAt, clock);
        return text === previous.text ? previous : { startedAt, text };
      });
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [startedAt, clock]);

  return <span className={className}>{shown.text}</span>;
}
