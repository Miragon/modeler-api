/** UI-only state (panels/overlays) kept separate from the document store. */

import { create } from "zustand";

interface UiState {
  helpOpen: boolean;
  /** "New diagram" on the welcome card hides it for the session, even while the canvas is empty. */
  welcomeDismissed: boolean;
  toggleHelp: () => void;
  setHelp: (open: boolean) => void;
  dismissWelcome: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  helpOpen: false,
  welcomeDismissed: false,
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
  setHelp: (open) => set({ helpOpen: open }),
  dismissWelcome: () => set({ welcomeDismissed: true }),
}));
