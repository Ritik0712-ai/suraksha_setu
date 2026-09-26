import { create } from "zustand";

// S-10 draft, kept in memory only (docs/03 S-10: "the draft (except the photo file) is kept in
// memory"). Cleared after submit or when the citizen discards it.

const EMPTY = {
  photo: null, // { file, previewUrl }
  upload: null, // { uploadId, imageUrl } from POST /complaints/classify
  suggestion: null, // { category, confidence, top3, modelVersion } | null
  aiChecked: false, // classify finished (with or without a suggestion)
  category: null,
  location: null, // { lat, lng, accuracyM }
  locationSource: null, // "gps" | "pin" | "village"
  landmark: "",
  description: "",
  onBehalf: false,
  onBehalfName: "",
  onBehalfPhone: "",
};

export const useComplaintDraft = create((set, get) => ({
  ...EMPTY,
  update: (patch) => set(patch),
  setPhoto: (file) => {
    const prev = get().photo;
    if (prev?.previewUrl) URL.revokeObjectURL?.(prev.previewUrl);
    set({
      photo: file ? { file, previewUrl: URL.createObjectURL?.(file) ?? "" } : null,
      upload: null,
      suggestion: null,
      aiChecked: false,
    });
  },
  reset: () => {
    const prev = get().photo;
    if (prev?.previewUrl) URL.revokeObjectURL?.(prev.previewUrl);
    set({ ...EMPTY });
  },
}));

/** True once the citizen has entered anything worth asking about before leaving. */
export const isDraftDirty = (s) =>
  Boolean(s.photo || s.category || s.landmark || s.description || s.onBehalfName);
