const { admin, subscriptionsCollection } = require("../utils/firebase/index");
const SubscriptionModel = require("../models/SubscriptionModel");

/**
 * Family invites are only for emails that already have a Firebase Auth account,
 * and that do not currently have active premium access (MySQL and/or Firestore).
 *
 * @param {string} emailNormalized lowercased trimmed email
 * @returns {Promise<{ ok: true, uid: string } | { ok: false, error: string }>}
 */
async function checkInviteeCanBeInvited(emailNormalized) {
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(emailNormalized);
  } catch (e) {
    if (e.code === "auth/user-not-found") {
      return {
        ok: false,
        error:
          "This email is not registered in the app. Ask them to create an account first.",
      };
    }
    throw e;
  }

  const uid = userRecord.uid;

  const byEmail = await SubscriptionModel.getActiveByEmail(emailNormalized);
  if (byEmail) {
    return {
      ok: false,
      error: "This email already has an active subscription",
    };
  }

  const byUid = await SubscriptionModel.getByUidActive(uid);
  if (byUid) {
    return {
      ok: false,
      error: "This user already has an active subscription",
    };
  }

  const snap = await subscriptionsCollection.doc(uid).get();
  if (snap.exists) {
    const d = snap.data() || {};
    const st = String(d.status || "").toLowerCase();
    if (st === "active") {
      return {
        ok: false,
        error: "This user already has an active subscription",
      };
    }
  }

  return { ok: true, uid };
}

module.exports = {
  checkInviteeCanBeInvited,
};
