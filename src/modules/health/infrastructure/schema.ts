// Tables owned by the health module (docs/modules/health.md §2). app/db.ts composes them into
// db.version(n).stores({...}); no other module reads or writes them (P-4). No index on recordedAt:
// an Instant is never sorted as a string (ADR-0009), so the service sorts in memory (RN-HLT-14).
export const healthStores: Record<'painEntries', string> = {
  painEntries: 'id, &workoutId',
};
