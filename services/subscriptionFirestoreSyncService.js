const SubscriptionModel = require("../models/SubscriptionModel");
const FamilyModel = require("../models/FamilyModel");
const { subscriptionsCollection } = require("../utils/firebase/index");

function toIso(d) {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/**
 * Denormalize MySQL subscription + family state to Firestore `subscriptions/{uid}`.
 * Backend is source of truth; clients should not write this doc.
 *
 * @param {string} uid Firebase UID
 * @returns {Promise<{ ok?: boolean, kind?: string, deleted?: boolean, reason?: string }>}
 */
async function syncSubscriptionToFirestore(uid) {
  const uidStr = String(uid);
  const familyCtx = await FamilyModel.getActiveFamilyAccessForUid(uidStr);

  if (familyCtx) {
    if (familyCtx.role === "owner") {
      const sub = await SubscriptionModel.getByUidActive(uidStr);
      if (!sub || String(sub.status).toLowerCase() !== "active") {
        await subscriptionsCollection.doc(uidStr).delete().catch(() => {});
        return { deleted: true, reason: "owner_no_active_subscription" };
      }
      const exp = new Date(sub.expiration_date);
      if (exp < new Date()) {
        await subscriptionsCollection.doc(uidStr).delete().catch(() => {});
        return { deleted: true, reason: "subscription_expired" };
      }
      const payload = {
        userID: uidStr,
        email: sub.email,
        status: "active",
        planKind: "family",
        planCode: familyCtx.plan_code || null,
        plan_kind: familyCtx.plan_kind || null,
        familyId: String(familyCtx.family_id),
        role: "owner",
        familyTier: familyCtx.plan_tier,
        expiresAt: toIso(familyCtx.expires_at) || toIso(sub.expiration_date),
      };
      await subscriptionsCollection.doc(uidStr).set(payload);
      return { ok: true, kind: "family_owner" };
    }

    const payload = {
      userID: uidStr,
      email: familyCtx.member_email || "",
      status: "active",
      planKind: "family",
      planCode: familyCtx.plan_code || null,
      plan_kind: familyCtx.plan_kind || null,
      familyId: String(familyCtx.family_id),
      role: "member",
      familyTier: familyCtx.plan_tier,
      expiresAt: toIso(familyCtx.expires_at),
    };
    await subscriptionsCollection.doc(uidStr).set(payload);
    return { ok: true, kind: "family_member" };
  }

  const sub = await SubscriptionModel.getByUidActive(uidStr);
  if (!sub || String(sub.status).toLowerCase() !== "active") {
    await subscriptionsCollection.doc(uidStr).delete().catch(() => {});
    return { deleted: true, reason: "no_active_subscription" };
  }
  const exp = new Date(sub.expiration_date);
  if (exp < new Date()) {
    await subscriptionsCollection.doc(uidStr).delete().catch(() => {});
    return { deleted: true, reason: "subscription_expired" };
  }

  const payload = {
    userID: uidStr,
    email: sub.email,
    status: "active",
    planKind: "individual",
    planCode: null,
    plan_kind: null,
    expiresAt: toIso(sub.expiration_date),
  };
  await subscriptionsCollection.doc(uidStr).set(payload);
  return { ok: true, kind: "individual" };
}

module.exports = {
  syncSubscriptionToFirestore,
};
