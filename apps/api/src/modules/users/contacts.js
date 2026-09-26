import { Router } from "express";
import { z } from "zod";
import C from "../../config/constants.js";
import { AppError } from "../../lib/errors.js";
import { requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { User } from "../../models/User.js";
import { contactBody, contactPatchBody, objectId } from "../auth/schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const toJSON = (c) => ({
  id: String(c._id),
  name: c.name,
  relation: c.relation,
  phone: c.phone,
  email: c.email ?? null,
});

/**
 * Emergency contacts (docs/02 §7.2, docs/03 S-28): at most 5, never the user's own number,
 * no duplicates. Mounted under /users/me/contacts after requireAuth.
 */
export function contactsRouter() {
  const router = Router();
  router.use(requireRole("citizen"));

  function checkPhone(user, phone, exceptId) {
    if (phone === user.phone)
      throw new AppError("VALIDATION_ERROR", "own_number", [
        { field: "phone", issue: "own_number" },
      ]);
    if (user.emergencyContacts.some((c) => c.phone === phone && String(c._id) !== exceptId))
      throw new AppError("CONFLICT", "contact_duplicate", [{ field: "phone", issue: "duplicate" }]);
  }

  router.get(
    "/",
    wrap(async (req, res) => {
      const user = await User.findById(req.user._id).select("emergencyContacts").lean();
      res.json({ data: user.emergencyContacts.map(toJSON) });
    }),
  );

  router.post(
    "/",
    validate({ body: contactBody }),
    wrap(async (req, res) => {
      const user = await User.findById(req.user._id);
      if (user.emergencyContacts.length >= C.maxEmergencyContacts)
        throw new AppError("VALIDATION_ERROR", "too_many_contacts");
      checkPhone(user, req.body.phone);
      user.emergencyContacts.push(req.body);
      await user.save();
      res.status(201).json({ data: toJSON(user.emergencyContacts.at(-1)) });
    }),
  );

  router.patch(
    "/:contactId",
    validate({ params: z.object({ contactId: objectId }), body: contactPatchBody }),
    wrap(async (req, res) => {
      const user = await User.findById(req.user._id);
      const contact = user.emergencyContacts.id(req.params.contactId);
      if (!contact) throw new AppError("NOT_FOUND", "contact_not_found");
      if (req.body.phone) checkPhone(user, req.body.phone, req.params.contactId);
      contact.set(req.body);
      await user.save();
      res.json({ data: toJSON(contact) });
    }),
  );

  router.delete(
    "/:contactId",
    validate({ params: z.object({ contactId: objectId }) }),
    wrap(async (req, res) => {
      // Match on the contact id: `timestamps` bumps updatedAt, so modifiedCount is never 0.
      const { matchedCount } = await User.updateOne(
        { _id: req.user._id, "emergencyContacts._id": req.params.contactId },
        { $pull: { emergencyContacts: { _id: req.params.contactId } } },
      );
      if (!matchedCount) throw new AppError("NOT_FOUND", "contact_not_found");
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}
