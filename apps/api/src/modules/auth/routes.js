import { Router } from "express";
import { ACCESS_TOKEN_TTL_SEC } from "../../lib/tokens.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { User } from "../../models/User.js";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./cookies.js";
import { forgotBody, loginBody, registerBody, resetBody } from "./schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/** /api/v1/auth/* (docs/02 §7.2 "Auth"). */
export function authRouter({ env, auth, limiters }) {
  const router = Router();
  const authed = requireAuth(env);

  /** Sends the access token in the body and the refresh token as a cookie. */
  function sendTokens(res, tokens, status = 200) {
    setRefreshCookie(res, env, tokens.refreshToken, tokens.refreshExpiresAt);
    res.status(status).json({
      data: {
        accessToken: tokens.accessToken,
        expiresIn: ACCESS_TOKEN_TTL_SEC,
        user: tokens.user.toSelfJSON(),
      },
    });
  }

  router.post(
    "/register",
    limiters.register,
    validate({ body: registerBody }),
    wrap(async (req, res) => sendTokens(res, await auth.register(req.body, req), 201)),
  );

  router.post(
    "/login",
    limiters.login,
    validate({ body: loginBody }),
    wrap(async (req, res) => sendTokens(res, await auth.login(req.body, req))),
  );

  router.post(
    "/refresh",
    wrap(async (req, res) => {
      try {
        sendTokens(res, await auth.refresh(readRefreshCookie(req), req));
      } catch (err) {
        clearRefreshCookie(res, env);
        throw err;
      }
    }),
  );

  router.post(
    "/logout",
    authed,
    wrap(async (req, res) => {
      await auth.logout(req.user._id, readRefreshCookie(req));
      clearRefreshCookie(res, env);
      res.json({ data: { ok: true } });
    }),
  );

  router.post(
    "/logout-all",
    authed,
    wrap(async (req, res) => {
      await auth.logoutAll(req.user._id);
      clearRefreshCookie(res, env);
      res.json({ data: { ok: true } });
    }),
  );

  router.post(
    "/password/forgot",
    limiters.passwordReset,
    validate({ body: forgotBody }),
    wrap(async (req, res) => {
      await auth.forgotPassword(req.body);
      // Same answer whether or not the number or an email exists (docs/03 S-05).
      res.json({ data: { ok: true } });
    }),
  );

  router.post(
    "/password/reset",
    limiters.passwordReset,
    validate({ body: resetBody }),
    wrap(async (req, res) => {
      await auth.resetPassword(req.body);
      clearRefreshCookie(res, env);
      res.json({ data: { ok: true } });
    }),
  );

  router.get(
    "/me",
    authed,
    wrap(async (req, res) => {
      const user = await User.findById(req.user._id);
      res.json({ data: user.toSelfJSON() });
    }),
  );

  return router;
}
