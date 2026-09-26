import { z } from "zod";
import C from "../../config/constants.js";
import { inIndia } from "../../models/common.js";

const point = z
  .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
  .superRefine((v, ctx) => {
    if (!inIndia([v.lng, v.lat]))
      ctx.addIssue({ code: "custom", path: ["lat"], message: "outside_india" });
  });

export const RADII_KM = [5, 10, 25, 50];

export const donorBody = z.object({
  bloodGroup: z.enum(C.bloodGroups),
  // null = never donated (docs/03 S-23); never in the future.
  lastDonatedAt: z.coerce
    .date()
    .refine((d) => d <= new Date(), "future_date")
    .nullable(),
  // null = use the home village centroid.
  location: point.nullable(),
  available: z.boolean().default(true),
  consent: z.literal(true, { errorMap: () => ({ message: "consent_required" }) }),
});

export const availabilityBody = z.object({ available: z.boolean() });

export const searchQuery = z
  .object({
    bloodGroup: z.enum(C.bloodGroups),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce
      .number()
      .refine((v) => RADII_KM.includes(v), "invalid")
      .default(25),
    includeCompatible: z
      .enum(["true", "false", "1", "0"])
      .default("true")
      .transform((v) => v === "true" || v === "1"),
  })
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lng === undefined))
      ctx.addIssue({ code: "custom", path: ["lat"], message: "required" });
  });

export const revealBody = z.object({ bloodGroupSearched: z.enum(C.bloodGroups) });
