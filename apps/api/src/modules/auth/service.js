import { randomUUID } from "node:crypto";
import C from "../../config/constants.js";
import { AppError } from "../../lib/errors.js";
import { burnTime, hashPassword, verifyPassword } from "../../lib/password.js";
import { ipPrefix, userAgent } from "../../lib/request.js";
import {
  hashSecret,
  randomCode,
  randomToken,
  sessionTtlMs,
  signAccessToken,
} from "../../lib/tokens.js";
import { invalidateUser } from "../../middleware/auth.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { PasswordReset, RESET_MAX_ATTEMPTS, RESET_TTL_MS } from "../../models/PasswordReset.js";
import { Session } from "../../models/Session.js";
import { User } from "../../models/User.js";

export const MAX_FAILED_LOGINS = 10; // docs/02 SEC-18
export const LOCK_MS = 30 * 60 * 1000;

const isDuplicateKey = (err) => err?.code === 11000;

/**
 * Auth business logic (docs/05 §7). Pure of HTTP except for reading ip/user-agent from `req`
 * when creating sessions.
 */
export function createAuthService({ env, mailer }) {
  const pepper = env.REFRESH_TOKEN_PEPPER;

  // --- sessions ----------------------------------------------------------------------------

  async function createSession(user, req, familyId = randomUUID()) {
    const token = randomToken();
    const now = new Date();
    const session = await Session.create({
      userId: user._id,
      tokenHash: hashSecret(token, pepper),
      familyId,
      userAgent: userAgent(req),
      ipPrefix: ipPrefix(req.ip),
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + sessionTtlMs(user.role)),
    });
    return { token, session };
  }

  /** Session + access token for a freshly authenticated user. */
  async function issueTokens(user, req, familyId) {
    const { token, session } = await createSession(user, req, familyId);
    return {
      accessToken: signAccessToken(user, env.JWT_ACCESS_SECRET),
      refreshToken: token,
      refreshExpiresAt: session.expiresAt,
      sessionId: session._id,
      user,
    };
  }

  async function revokeAllSessions(userId) {
    await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  }

  /** Logout-all / password change / reset: kill every access token and refresh session. */
  async function invalidateEverywhere(userId) {
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
    await revokeAllSessions(userId);
    invalidateUser(userId);
  }

  // --- registration & login ----------------------------------------------------------------

  /** jurisdictionId must be an active village; "my village is not listed" → default district. */
  async function resolveHomeJurisdiction({ jurisdictionId, villageOther }) {
    if (jurisdictionId) {
      const j = await Jurisdiction.findOne({ _id: jurisdictionId, active: true, type: "village" })
        .select("_id")
        .lean();
      if (!j)
        throw new AppError("VALIDATION_ERROR", "invalid_jurisdiction", [
          { field: "jurisdictionId", issue: "invalid" },
        ]);
      return { jurisdictionId: j._id, villageOther: null };
    }
    const district = await Jurisdiction.findOne({ active: true, type: "district" })
      .sort({ createdAt: 1 })
      .select("_id")
      .lean();
    if (!district) throw new AppError("VALIDATION_ERROR", "invalid_jurisdiction");
    return { jurisdictionId: district._id, villageOther };
  }

  async function register(input, req) {
    const home = await resolveHomeJurisdiction(input);
    const passwordHash = await hashPassword(input.password, env.BCRYPT_COST);
    let user;
    try {
      user = await User.create({
        name: input.name,
        phone: input.phone,
        passwordHash,
        role: "citizen",
        language: input.language ?? C.defaultLanguage,
        gender: input.gender ?? null,
        ...home,
        consent: { version: C.consentVersion, acceptedAt: new Date() },
        lastLoginAt: new Date(),
      });
    } catch (err) {
      if (isDuplicateKey(err))
        throw new AppError("CONFLICT", "phone_taken", [{ field: "phone", issue: "taken" }]);
      throw err;
    }
    return issueTokens(user, req);
  }

  async function notifyLocked(user) {
    if (!user.email) return;
    const hi = user.language !== "en";
    await mailer.send(
      user.email,
      hi ? "सुरक्षा सेतु: खाता 30 मिनट के लिए बंद" : "Suraksha Setu: account locked for 30 minutes",
      hi
        ? "आपके खाते में बहुत बार गलत पासवर्ड डाला गया, इसलिए इसे 30 मिनट के लिए बंद किया गया है। अगर यह आप नहीं थे, तो 30 मिनट बाद पासवर्ड बदल दें।"
        : "There were too many wrong password attempts on your account, so it is locked for 30 minutes. If this wasn't you, change your password after 30 minutes.",
    );
  }

  async function login({ phone, password }, req) {
    const user = await User.findOne({ phone }).select("+passwordHash");
    if (!user || user.status === "deleted") {
      await burnTime(password);
      throw new AppError("UNAUTHENTICATED", "invalid_credentials");
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) throw new AppError("ACCOUNT_LOCKED");

    if (!(await verifyPassword(password, user.passwordHash))) {
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { failedLoginCount: 1 } },
        { new: true },
      );
      if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
        await User.updateOne(
          { _id: user._id },
          { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS), failedLoginCount: 0 } },
        );
        notifyLocked(user).catch(() => {});
      }
      throw new AppError("UNAUTHENTICATED", "invalid_credentials");
    }

    // Only revealed after a correct password, so it can't be used to probe numbers.
    if (user.status !== "active") throw new AppError("FORBIDDEN", "account_inactive");

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = now;
    await user.save();
    return issueTokens(user, req);
  }

  // --- refresh (rotation with reuse detection, docs/05 §7.3) --------------------------------

  async function refresh(presentedToken, req) {
    if (!presentedToken) throw new AppError("UNAUTHENTICATED");
    const session = await Session.findOne({ tokenHash: hashSecret(presentedToken, pepper) });
    if (!session) throw new AppError("UNAUTHENTICATED");

    const now = new Date();
    if (session.revokedAt) {
      // A rotated-out token came back: assume theft and end the whole login.
      await Session.updateMany(
        { familyId: session.familyId, revokedAt: null },
        { $set: { revokedAt: now } },
      );
      throw new AppError("UNAUTHENTICATED");
    }
    if (session.expiresAt <= now) throw new AppError("UNAUTHENTICATED");

    const user = await User.findById(session.userId);
    if (!user || user.status !== "active") {
      await Session.updateMany({ familyId: session.familyId }, { $set: { revokedAt: now } });
      throw new AppError("UNAUTHENTICATED");
    }

    // Claim the old session atomically so two concurrent refreshes can't both rotate it.
    const claimed = await Session.findOneAndUpdate(
      { _id: session._id, revokedAt: null },
      { $set: { revokedAt: now, lastUsedAt: now } },
    );
    if (!claimed) {
      await Session.updateMany(
        { familyId: session.familyId, revokedAt: null },
        { $set: { revokedAt: now } },
      );
      throw new AppError("UNAUTHENTICATED");
    }

    const tokens = await issueTokens(user, req, session.familyId);
    await Session.updateOne({ _id: session._id }, { $set: { replacedBy: tokens.sessionId } });
    return tokens;
  }

  // --- logout ------------------------------------------------------------------------------

  async function logout(userId, presentedToken) {
    if (!presentedToken) return;
    await Session.updateOne(
      { userId, tokenHash: hashSecret(presentedToken, pepper), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  const logoutAll = (userId) => invalidateEverywhere(userId);

  // --- passwords ---------------------------------------------------------------------------

  async function setPassword(userId, newPassword) {
    const passwordHash = await hashPassword(newPassword, env.BCRYPT_COST);
    await User.updateOne(
      { _id: userId },
      {
        $set: { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
      },
    );
    await invalidateEverywhere(userId);
  }

  /** Change password (old + new). Every other device is logged out; this one gets new tokens. */
  async function changePassword(userId, { currentPassword, newPassword }, req) {
    const user = await User.findById(userId).select("+passwordHash");
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash)))
      throw new AppError("VALIDATION_ERROR", "wrong_current_password", [
        { field: "currentPassword", issue: "incorrect" },
      ]);
    await setPassword(userId, newPassword);
    return issueTokens(await User.findById(userId), req);
  }

  /** Always resolves the same way, whether or not the number or an email exists. */
  async function forgotPassword({ phone }) {
    const user = await User.findOne({ phone, status: "active" })
      .select("_id email language")
      .lean();
    if (!user?.email) return;

    const token = randomToken();
    await PasswordReset.deleteMany({ userId: user._id, kind: "email_token", usedAt: null });
    await PasswordReset.create({
      userId: user._id,
      kind: "email_token",
      secretHash: hashSecret(token, pepper),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });

    const link = `${env.PUBLIC_APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    const hi = user.language !== "en";
    mailer
      .send(
        user.email,
        hi ? "सुरक्षा सेतु: पासवर्ड बदलें" : "Suraksha Setu: reset your password",
        hi
          ? `पासवर्ड बदलने के लिए यह लिंक खोलें (30 मिनट तक मान्य):\n${link}\n\nअगर आपने यह नहीं माँगा, तो इस ईमेल को अनदेखा करें।`
          : `Open this link to reset your password (valid for 30 minutes):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
      )
      .catch(() => {});
  }

  const invalidReset = () => new AppError("VALIDATION_ERROR", "reset_invalid");

  /** Reset with an email token or an admin-issued code. Revokes all sessions on success. */
  async function resetPassword(input) {
    const now = new Date();
    let userId;

    if ("token" in input) {
      const reset = await PasswordReset.findOneAndUpdate(
        {
          kind: "email_token",
          secretHash: hashSecret(input.token, pepper),
          usedAt: null,
          expiresAt: { $gt: now },
        },
        { $set: { usedAt: now } },
      );
      if (!reset) throw invalidReset();
      userId = reset.userId;
    } else {
      const user = await User.findOne({ phone: input.phone }).select("_id").lean();
      if (!user) throw invalidReset();
      const reset = await PasswordReset.findOne({
        userId: user._id,
        kind: "admin_code",
        usedAt: null,
        expiresAt: { $gt: now },
      }).sort({ createdAt: -1 });
      if (!reset || reset.attempts >= RESET_MAX_ATTEMPTS) throw invalidReset();

      if (reset.secretHash !== hashSecret(input.code, pepper)) {
        await PasswordReset.updateOne({ _id: reset._id }, { $inc: { attempts: 1 } });
        throw invalidReset();
      }
      const claimed = await PasswordReset.findOneAndUpdate(
        { _id: reset._id, usedAt: null },
        { $set: { usedAt: now } },
      );
      if (!claimed) throw invalidReset();
      userId = user._id;
    }

    const user = await User.findById(userId).select("status").lean();
    if (!user || user.status !== "active") throw invalidReset();
    await setPassword(userId, input.password);
  }

  /** Admin-issued one-time code for users without email (docs/02 §6.2). Returns the raw code once. */
  async function issueResetCode(targetUserId, adminId) {
    const user = await User.findOne({ _id: targetUserId, status: { $ne: "deleted" } })
      .select("_id")
      .lean();
    if (!user) throw new AppError("NOT_FOUND", "user_not_found");

    const now = new Date();
    // Only the newest code works.
    await PasswordReset.updateMany(
      { userId: user._id, kind: "admin_code", usedAt: null },
      { $set: { expiresAt: now } },
    );
    const code = randomCode();
    const reset = await PasswordReset.create({
      userId: user._id,
      kind: "admin_code",
      secretHash: hashSecret(code, pepper),
      issuedBy: adminId,
      expiresAt: new Date(now.getTime() + RESET_TTL_MS),
    });
    return { code, expiresAt: reset.expiresAt };
  }

  return {
    register,
    login,
    refresh,
    logout,
    logoutAll,
    changePassword,
    forgotPassword,
    resetPassword,
    issueResetCode,
    resolveHomeJurisdiction,
  };
}
