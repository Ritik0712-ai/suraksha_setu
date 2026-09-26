import { Router } from "express";
import { AppError } from "../../lib/errors.js";
import { ACCESS_TOKEN_TTL_SEC } from "../../lib/tokens.js";
import { invalidateUser, requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { User } from "../../models/User.js";
import { setRefreshCookie } from "../auth/cookies.js";
import { changePasswordBody, updateMeBody } from "../auth/schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/** /api/v1/users/me — profile and password (docs/02 §7.2 "Profile and contacts"). */
export function usersRouter({ env, auth }) {
  const router = Router();
  router.use(requireAuth(env));

  router.patch(
    "/me",
    validate({ body: updateMeBody }),
    wrap(async (req, res) => {
      const { jurisdictionId, villageOther, ...rest } = req.body;
      const update = { ...rest };
      // Only citizens have a home village that routes their SOS/complaints.
      if (jurisdictionId || villageOther) {
        if (req.user.role !== "citizen") throw new AppError("FORBIDDEN");
        Object.assign(update, await auth.resolveHomeJurisdiction({ jurisdictionId, villageOther }));
      }
      let user;
      try {
        user = await User.findByIdAndUpdate(
          req.user._id,
          { $set: update },
          { new: true, runValidators: true },
        );
      } catch (err) {
        if (err?.code === 11000)
          throw new AppError("CONFLICT", "email_taken", [{ field: "email", issue: "taken" }]);
        throw err;
      }
      invalidateUser(req.user._id);
      res.json({ data: user.toSelfJSON() });
    }),
  );

  router.put(
    "/me/password",
    validate({ body: changePasswordBody }),
    wrap(async (req, res) => {
      const tokens = await auth.changePassword(req.user._id, req.body, req);
      setRefreshCookie(res, env, tokens.refreshToken, tokens.refreshExpiresAt);
      res.json({
        data: {
          accessToken: tokens.accessToken,
          expiresIn: ACCESS_TOKEN_TTL_SEC,
          user: tokens.user.toSelfJSON(),
        },
      });
    }),
  );

  return router;
}
