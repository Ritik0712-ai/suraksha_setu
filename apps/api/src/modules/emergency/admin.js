import { Router } from "express";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { parseCsvObjects, toCsv } from "../../lib/csv.js";
import { toLatLng, toPoint } from "../../lib/distance.js";
import { AppError } from "../../lib/errors.js";
import { validate } from "../../middleware/validate.js";
import { EmergencyService } from "../../models/EmergencyService.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { resolveJurisdiction } from "../../services/jurisdictionResolver.js";
import { objectId } from "../auth/schemas.js";
import { curatedView } from "./routes.js";
import { serviceBody } from "./schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const idParam = { params: z.object({ id: objectId }) };

export const CSV_COLUMNS = [
  "name_hi",
  "name_en",
  "type",
  "address_hi",
  "address_en",
  "phones",
  "lat",
  "lng",
  "is24x7",
  "notes_hi",
  "notes_en",
  "verified_on",
];

/** The pilot village (first village seeded): A-10 shows distances from it. */
async function pilotVillage() {
  return Jurisdiction.findOne({ type: "village", active: true }).sort({ createdAt: 1 }).lean();
}

async function toDoc(body, user) {
  const point = { lat: body.lat, lng: body.lng };
  const { jurisdictionId } = await resolveJurisdiction(point, user.jurisdictionId);
  return {
    name: body.name,
    type: body.type,
    address: body.address,
    phones: body.phones,
    location: toPoint(point),
    jurisdictionId,
    is24x7: body.is24x7,
    notes: body.notes ?? undefined,
    verifiedAt: body.verifiedOn,
    verifiedBy: user._id,
    active: body.active,
  };
}

/** CSV row → serviceBody input (A-10 "Import CSV"). */
export function rowToBody(r) {
  const notes =
    r.notes_hi || r.notes_en
      ? { hi: r.notes_hi || r.notes_en, en: r.notes_en || r.notes_hi }
      : null;
  return {
    name: { hi: r.name_hi, en: r.name_en },
    type: r.type,
    address: { hi: r.address_hi, en: r.address_en },
    phones: (r.phones ?? "")
      .split(/[;|]/)
      .map((p) => p.trim())
      .filter(Boolean),
    lat: Number(r.lat),
    lng: Number(r.lng),
    is24x7: /^(yes|y|true|1|हाँ)$/i.test(r.is24x7 ?? ""),
    notes,
    verifiedOn: r.verified_on,
    active: true,
  };
}

/** /api/v1/admin/emergency-services (docs/03 A-10). Behind requireRole("admin"). */
export function adminEmergencyRouter() {
  const router = Router();

  router.get(
    "/",
    wrap(async (_req, res) => {
      const [list, village] = await Promise.all([
        EmergencyService.find({}).sort({ type: 1, "name.en": 1 }).lean(),
        pilotVillage(),
      ]);
      const from = village ? toLatLng(village.centroid) : null;
      res.json({ data: list.map((s) => ({ ...curatedView(s, from), active: s.active })) });
    }),
  );

  router.get("/template.csv", (_req, res) => {
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="emergency_services_template.csv"');
    res.send(
      toCsv([
        CSV_COLUMNS,
        [
          "जिला अस्पताल सीहोर",
          "District Hospital Sehore",
          "hospital",
          "सीहोर",
          "Sehore",
          "07562-000000",
          "23.2",
          "77.08",
          "yes",
          "",
          "",
          "2026-10-01",
        ],
      ]),
    );
  });

  router.post(
    "/",
    validate({ body: serviceBody }),
    wrap(async (req, res) => {
      const s = await EmergencyService.create(await toDoc(req.body, req.user));
      await audit(req, {
        action: "emergency.created",
        targetType: "emergency_services",
        targetId: s._id,
      });
      res.status(201).json({ data: { ...curatedView(s.toObject()), active: s.active } });
    }),
  );

  router.patch(
    "/:id",
    validate({ ...idParam, body: serviceBody }),
    wrap(async (req, res) => {
      const s = await EmergencyService.findById(req.params.id);
      if (!s) throw new AppError("NOT_FOUND");
      s.set(await toDoc(req.body, req.user));
      await s.save();
      await audit(req, {
        action: "emergency.updated",
        targetType: "emergency_services",
        targetId: s._id,
      });
      res.json({ data: { ...curatedView(s.toObject()), active: s.active } });
    }),
  );

  // Rows are all checked first; nothing is written unless every row is valid.
  router.post(
    "/import",
    validate({ body: z.object({ csv: z.string().min(1).max(200_000) }) }),
    wrap(async (req, res) => {
      const rows = parseCsvObjects(req.body.csv);
      if (!rows.length) throw new AppError("VALIDATION_ERROR", "csv_empty");
      const missing = CSV_COLUMNS.filter((c) => !(c in rows[0]));
      if (missing.length)
        throw new AppError(
          "VALIDATION_ERROR",
          "csv_columns",
          missing.map((c) => ({ field: c, issue: "required" })),
        );
      const errors = [];
      const bodies = [];
      rows.forEach((r, i) => {
        const parsed = serviceBody.safeParse(rowToBody(r));
        if (parsed.success) bodies.push(parsed.data);
        else
          for (const issue of parsed.error.issues)
            errors.push({ field: `row ${i + 2}: ${issue.path.join(".")}`, issue: issue.message });
      });
      if (errors.length) throw new AppError("VALIDATION_ERROR", "csv_rows", errors.slice(0, 50));
      const docs = [];
      for (const b of bodies) docs.push(await toDoc(b, req.user));
      const created = await EmergencyService.insertMany(docs);
      for (const s of created)
        await audit(req, {
          action: "emergency.created",
          targetType: "emergency_services",
          targetId: s._id,
        });
      res.status(201).json({ data: { imported: created.length } });
    }),
  );

  return router;
}
