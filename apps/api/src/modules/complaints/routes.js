import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { LOCAL_NAME, sniffImage } from "../../lib/storage.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { objectId } from "../auth/schemas.js";
import { createBody, mineQuery, reopenBody, routePreviewQuery } from "./schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const idParam = { params: z.object({ id: objectId }) };
const citizen = requireRole("citizen");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // docs/02 SEC-07

/** Multer in memory (no disk on Render, docs/02 §3): one field "image", max 5 MB. */
function imageUpload() {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
  }).single("image");
  return (req, res, next) =>
    upload(req, res, (err) => {
      if (err?.code === "LIMIT_FILE_SIZE")
        return next(new AppError("VALIDATION_ERROR", "image_too_large"));
      if (err) return next(new AppError("VALIDATION_ERROR", "image_required"));
      if (!req.file) return next(new AppError("VALIDATION_ERROR", "image_required"));
      // Magic bytes decide, not the client's Content-Type (docs/02 SEC-07).
      const mime = sniffImage(req.file.buffer);
      if (!mime) return next(new AppError("VALIDATION_ERROR", "image_type"));
      req.image = { buffer: req.file.buffer, mime };
      next();
    });
}

/** /api/v1/complaints — citizen side (docs/02 §7.2 "Complaints (M2)"). */
export function complaintsRouter({ env, complaints, ai }) {
  const router = Router();
  router.use(requireAuth(env));

  router.post(
    "/classify",
    citizen,
    imageUpload(),
    wrap(async (req, res) => {
      res.status(201).json({ data: await complaints.classify(req.user._id, req.image) });
    }),
  );

  // Wakes the AI service when the wizard opens (docs/02 §12); never an error for the client.
  router.get(
    "/classify/warmup",
    citizen,
    wrap(async (_req, res) => {
      const { ok } = await ai.health();
      res.json({ data: { ai: ok ? "up" : "down" } });
    }),
  );

  router.get(
    "/route-preview",
    citizen,
    validate({ query: routePreviewQuery }),
    wrap(async (req, res) => {
      res.json({ data: await complaints.routePreview(req.user, req.validatedQuery) });
    }),
  );

  router.post(
    "/",
    citizen,
    validate({ body: createBody }),
    wrap(async (req, res) => {
      res.status(201).json({ data: await complaints.create(req.user, req.body) });
    }),
  );

  router.get(
    "/mine",
    citizen,
    validate({ query: mineQuery }),
    wrap(async (req, res) => {
      res.json({ data: await complaints.mine(req.user._id, req.validatedQuery) });
    }),
  );

  router.get(
    "/:id",
    validate(idParam),
    wrap(async (req, res) => {
      res.json({ data: await complaints.detail(req.user, req.params.id) });
    }),
  );

  router.post(
    "/:id/reopen",
    citizen,
    validate({ ...idParam, body: reopenBody }),
    wrap(async (req, res) => {
      res.json({ data: await complaints.reopen(req.user, req.params.id, req.body) });
    }),
  );

  return router;
}

/**
 * GET /api/v1/files/:name — local-disk photos, development only (production uses Cloudinary).
 * Names are random, so knowing the URL is what grants access, like a Cloudinary URL.
 */
export function filesRouter({ storage }) {
  const router = Router();
  router.get("/:name", (req, res, next) => {
    if (storage?.driver !== "local" || !LOCAL_NAME.test(req.params.name))
      return next(new AppError("NOT_FOUND"));
    // The web app runs on another origin in development; helmet defaults to same-origin.
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(path.join(storage.dir, req.params.name), { maxAge: "1d" }, (err) => {
      if (err) next(new AppError("NOT_FOUND"));
    });
  });
  return router;
}
