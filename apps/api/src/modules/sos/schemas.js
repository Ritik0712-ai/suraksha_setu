import { z } from "zod";
import C from "../../config/constants.js";
import { inIndia } from "../../models/common.js";

// docs/02 §7.2 "SOS (M1)". Coordinates must fall in India's rough bounding box (docs/05 §12).

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const accuracyM = z.number().min(0).max(100_000).optional();

const insideIndia = (v, ctx) => {
  if (v.lat === undefined || v.lng === undefined) return;
  if (!inIndia([v.lng, v.lat]))
    ctx.addIssue({ code: "custom", path: ["lat"], message: "outside_india" });
};

export const triggerBody = z
  .object({
    lat: lat.optional(),
    lng: lng.optional(),
    accuracyM,
    source: z.enum(C.sosLocationSource),
    // Set when the phone queued the SOS offline and is retrying (docs/03 S-06 step 4).
    triggeredAt: z.coerce.date().optional(),
    createdVia: z.enum(C.sosCreatedVia).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.source !== "village" && (v.lat === undefined || v.lng === undefined))
      ctx.addIssue({ code: "custom", path: ["lat"], message: "required" });
    insideIndia(v, ctx);
  });

export const locationBody = z
  .object({ lat, lng, accuracyM, at: z.coerce.date().optional() })
  .superRefine(insideIndia);

export const closeBody = z.object({
  outcome: z.enum(C.sosCloseOutcomes),
  note: z.string().trim().max(500).optional(),
});

export const revealBody = z.union([
  z.object({ target: z.literal("user") }),
  z.object({ target: z.literal("contact"), index: z.number().int().min(0).max(4) }),
]);
