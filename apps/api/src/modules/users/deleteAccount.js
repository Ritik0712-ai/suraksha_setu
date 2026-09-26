import { randomBytes } from "node:crypto";
import { hashPassword } from "../../lib/password.js";
import { ipPrefix } from "../../lib/request.js";
import { withTransaction } from "../../lib/transaction.js";
import { invalidateUser } from "../../middleware/auth.js";
import {
  AuditLog,
  BloodDonor,
  ChatMessage,
  ChatSession,
  Complaint,
  DonorContactRequest,
  Notification,
  SavedScheme,
  Session,
  SosAlert,
  User,
} from "../../models/index.js";

const round3 = (path) => ({
  $map: { input: `$${path}.coordinates`, in: { $round: ["$$this", 3] } },
});

/**
 * Account deletion (docs/05 §10, docs/03 S-27). Personal data is removed; complaints stay,
 * anonymised, so the authority can finish them; SOS records keep only rounded locations.
 */
export async function deleteAccount(user, req, { bcryptCost }) {
  const userId = user._id;
  // A random password nobody knows, so the account can never be logged into again.
  const passwordHash = await hashPassword(randomBytes(24).toString("base64url"), bcryptCost);

  await withTransaction(async (session) => {
    const opts = { session };
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          status: "deleted",
          name: "Deleted user",
          phone: null,
          email: null,
          emergencyContacts: [],
          eligibilityAnswers: null,
          gender: null,
          villageOther: null,
          passwordHash,
          deletedAt: new Date(),
        },
        $inc: { tokenVersion: 1 },
      },
      opts,
    );

    await Session.deleteMany({ userId }, opts);
    await BloodDonor.deleteMany({ userId }, opts);
    await SavedScheme.deleteMany({ userId }, opts);
    await ChatMessage.deleteMany({ userId }, opts);
    await ChatSession.deleteMany({ userId }, opts);
    await Notification.deleteMany({ recipientId: userId }, opts);
    await DonorContactRequest.deleteMany({ requesterId: userId }, opts);

    await SosAlert.updateMany(
      { userId },
      [
        {
          $set: {
            locationHistory: [],
            contactsSnapshot: [],
            "startLocation.coordinates": round3("startLocation"),
            "lastLocation.coordinates": round3("lastLocation"),
          },
        },
      ],
      opts,
    );

    await Complaint.updateMany(
      { citizenId: userId },
      { $set: { citizenId: null, onBehalfOf: null } },
      opts,
    );

    await AuditLog.create(
      [
        {
          actorId: userId,
          actorRole: user.role,
          action: "user.self_deleted",
          targetType: "users",
          targetId: userId,
          ipPrefix: ipPrefix(req.ip),
        },
      ],
      opts,
    );
  });

  invalidateUser(userId);
}
