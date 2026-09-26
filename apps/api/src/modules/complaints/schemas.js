import { z } from "zod";
import C from "../../config/constants.js";
import { inIndia } from "../../models/common.js";
import { objectId, personName, phone } from "../auth/schemas.js";

// docs/02 §7.2 "Complaints (M2)", docs/05 §5.6.

const location = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().min(0).max(100_000).optional(),
  })
  .superRefine((v, ctx) => {
    if (!inIndia([v.lng, v.lat]))
      ctx.addIssue({ code: "custom", path: ["lat"], message: "outside_india" });
  });

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const createBody = z.object({
  // Absent when the citizen reports without a photo (docs/03 S-10 step 1). The AI suggestion is
  // read from the upload record, never from the body (docs/05 §5.7).
  uploadId: objectId.optional(),
  category: z.enum(C.complaintCategories),
  description: optionalText(500),
  landmark: optionalText(100),
  // Absent when location was denied: the home village's centroid is used (docs/03 S-10 step 3).
  location: location.optional(),
  onBehalfOf: z
    .object({
      name: personName,
      phone: z.preprocess((v) => (v === "" || v === null ? undefined : v), phone.optional()),
    })
    .nullable()
    .optional(),
});

export const STATUS_FILTERS = ["open", "resolved", "rejected"];

export const mineQuery = z.object({
  status: z.enum(STATUS_FILTERS).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export const reopenBody = z.object({ reason: z.string().trim().min(10).max(500) });

export const routePreviewQuery = z
  .object({
    category: z.enum(C.complaintCategories),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lng === undefined))
      ctx.addIssue({ code: "custom", path: ["lat"], message: "required" });
  });
