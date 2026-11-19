import type { PainSummary } from '../application/service';
import { SafetyNote } from './SafetyNote';

// The amber pain notice of "Hoy" (docs/modules/health.md §4, "Componentes"; spec 005 AC-39 to
// AC-43). Informative, with no buttons. No aria-live: it is there when "Hoy" loads, not after an
// action.
export function PainNotice({ notice }: { notice: NonNullable<PainSummary['notice']> }) {
  return (
    <SafetyNote role="note" data-cause={notice.cause}>
      {notice.message}
    </SafetyNote>
  );
}
