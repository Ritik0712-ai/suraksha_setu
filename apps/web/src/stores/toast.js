import { create } from "zustand";

let nextId = 1;

/** One toast at a time, 4 seconds (docs/03 §0.2, docs/04 §6.6). */
export const useToast = create((set) => ({
  toast: null,
  show(message, severity = "success") {
    set({ toast: { id: nextId++, message, severity } });
  },
  hide() {
    set({ toast: null });
  },
}));

export const toast = (message, severity) => useToast.getState().show(message, severity);
