const db = require("../db/db");
const SubscriptionModel = require("../models/SubscriptionModel");
const FamilyModel = require("../models/FamilyModel");
const { subscriptionsCollection } = require("../utils/firebase/index");
const {
  syncSubscriptionToFirestore,
} = require("./subscriptionFirestoreSyncService");

/**
 * Revoke app subscription for a Firebase UID (Firestore + MySQL), mirroring cron expiry.
 * @param {string} uid
 */
async function adminRevokeSubscription(uid) {
  const docRef = subscriptionsCollection.doc(uid);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new Error("No subscription document for this user");
  }

  const data = snap.data() || {};
  const familyIdRaw = data.familyId;
  const familyId = familyIdRaw != null ? Number(familyIdRaw) : null;
  const role = data.role;

  if (familyId && !Number.isNaN(familyId) && role === "owner") {
    const fam = await FamilyModel.getFamilyById(familyId);
    if (!fam) {
      await docRef.delete();
      return { ok: true, kind: "family_owner_cleanup" };
    }
    const memberUids = await FamilyModel.getFamilyMemberUids(fam.id);
    const allUids = [...new Set([...memberUids, fam.owner_uid])];
    await db.query(`UPDATE family_groups SET status = 'inactive' WHERE id = ?`, [
      fam.id,
    ]);
    if (fam.subscription_id) {
      await db.query(`UPDATE subscriptions SET status = 'expired' WHERE id = ?`, [
        fam.subscription_id,
      ]);
    }
    for (const u of allUids) {
      try {
        await syncSubscriptionToFirestore(u);
      } catch (e) {
        console.error(`adminRevokeSubscription sync ${u}:`, e.message);
      }
    }
    return { ok: true, kind: "family" };
  }

  if (familyId && !Number.isNaN(familyId) && role !== "owner") {
    await db.query(
      `DELETE FROM family_members WHERE family_id = ? AND uid = ? AND role = 'member'`,
      [familyId, uid]
    );
    await syncSubscriptionToFirestore(uid);
    return { ok: true, kind: "family_member" };
  }

  const row = await SubscriptionModel.getByUidActive(uid);
  if (row) {
    await db.query(`UPDATE subscriptions SET status = 'expired' WHERE id = ?`, [
      row.id,
    ]);
  }
  await syncSubscriptionToFirestore(uid);
  return { ok: true, kind: "individual" };
}

module.exports = {
  adminRevokeSubscription,
};
