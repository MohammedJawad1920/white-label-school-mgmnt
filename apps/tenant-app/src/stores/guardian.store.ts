import { create } from "zustand";

interface GuardianState {
  selectedChildId: string | null;
  setSelectedChild: (id: string) => void;
  clearSelectedChild: () => void;
}

// UUID v4 validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function loadPersistedChildId(): string | null {
  try {
    const stored = sessionStorage.getItem("guardian-selected-child");
    if (stored && UUID_REGEX.test(stored)) return stored;
  } catch {
    // sessionStorage not available
  }
  return null;
}

export const useGuardianStore = create<GuardianState>((set) => ({
  selectedChildId: loadPersistedChildId(),
  setSelectedChild: (id) => {
    try {
      sessionStorage.setItem("guardian-selected-child", id);
    } catch {
      // ignore
    }
    set({ selectedChildId: id });
  },
  clearSelectedChild: () => {
    try {
      sessionStorage.removeItem("guardian-selected-child");
    } catch {
      // ignore
    }
    set({ selectedChildId: null });
  },
}));
