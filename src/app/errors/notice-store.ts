import { create } from 'zustand';

// Global notice (ADR-0006: ephemeral UI state). Only one notice is shown at a time (plan §6.11).
export interface Notice {
  message: string;
}

interface NoticeState {
  notice: Notice | null;
  /** Keeps the current notice if one is already visible. */
  showNotice: (notice: Notice) => void;
  dismissNotice: () => void;
}

export const useNoticeStore = create<NoticeState>()((set) => ({
  notice: null,
  showNotice: (notice) => {
    set((state) => (state.notice ? state : { notice }));
  },
  dismissNotice: () => {
    set({ notice: null });
  },
}));
