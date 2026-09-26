import { z } from "zod";
import C from "../../config/constants.js";
import { inIndia } from "../../models/common.js";
import { localized } from "../schemes/adminSchemas.js";

export const nearbyQuery = z
  .object({
    // Optional for a logged-in user: their home village centroid is used (docs/03 S-20).
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    type: z.enum(C.serviceTypes),
    radiusKm: z.coerce.number().min(1).max(50).default(25),
  })
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lng === undefined))
      ctx.addIssue({ code: "custom", path: ["lat"], message: "required" });
    else if (v.lat !== undefined && !inIndia([v.lng, v.lat]))
      ctx.addIssue({ code: "custom", path: ["lat"], message: "outside_india" });
  });

const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{3,20}$/, "invalid_phone");

export const serviceBody = z.object({
  name: localized(120),
  type: z.enum(C.serviceTypes),
  address: localized(200),
  phones: z.array(phone).min(1).max(4),
  lat: z.number().min(6).max(37.5),
  lng: z.number().min(68).max(97.5),
  is24x7: z.boolean().optional(),
  notes: localized(200).optional().nullable(),
  // The day it was confirmed by phone or a visit (docs/05 §11.3).
  verifiedOn: z.coerce.date().refine((d) => d <= new Date(), "future_date"),
  active: z.boolean().default(true),
});
