import mongoose from "mongoose";

const { Schema } = mongoose;

// Reusable sub-schemas from docs/05 §1.3.

export const LocalizedText = new Schema(
  {
    hi: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true },
  },
  { _id: false },
);

// India's rough bounding box (docs/05 §12). Coordinates are [lng, lat].
export const inIndia = ([lng, lat] = []) => lng >= 68 && lng <= 97.5 && lat >= 6 && lat <= 37.5;

export const GeoPoint = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: { validator: (v) => v.length === 2 && inIndia(v), message: "outside_india" },
    },
  },
  { _id: false },
);
