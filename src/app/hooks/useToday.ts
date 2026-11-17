import { useEffect, useState } from 'react';
import type { Clock, LocalDate } from '@/shared/kernel';

// Today's date, read again when the app comes back to the foreground, for example after
// midnight (spec 001 AC-20, plan §6.7). No timer needed.
export function useToday(clock: Clock): LocalDate {
  const [today, setToday] = useState(() => clock.today());

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setToday(clock.today());
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [clock]);

  return today;
}
