import { create } from "zustand";

// S-16/S-17 answers and results, in memory only (docs/03 S-16 privacy note).
export const useEligibility = create((set) => ({
  answers: {},
  results: null,
  save: false,
  setAnswer: (field, value) => set((s) => ({ answers: { ...s.answers, [field]: value } })),
  setAnswers: (answers) => set({ answers }),
  setResults: (results) => set({ results }),
  setSave: (save) => set({ save }),
  reset: () => set({ answers: {}, results: null, save: false }),
}));
