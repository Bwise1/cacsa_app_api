const db = require("../db/db");
const SubscriptionModel = require("../models/SubscriptionModel");
const FamilyModel = require("../models/FamilyModel");
const SubscriptionPlanModel = require("../models/SubscriptionPlanModel");
const { subscriptionsCollection } = require("../utils/firebase/index");
const {
  syncSubscriptionToFirestore,
} = require("./subscriptionFirestoreSyncService");
const { ReferralService } = require("./ReferralService");

const referralService = new ReferralService();

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

function isActiveStatus(status) {
  return String(status || "").trim().toLowerCase() === "active";
}

function buildAdminGrantReference(uid) {
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `admin_grant_${String(uid)}_${token}`.slice(0, 120);
}

/**
 * Grant subscription access to an existing Firebase user.
 * Mirrors paid subscription side-effects (family setup + Firestore sync + referral conversion).
 *
 * @param {{
 *   uid: string,
 *   email: string,
 *   planId: number,
 *   expiresAt?: string | Date | null
 * }} payload
 */
async function adminGrantSubscription(payload) {
  const uid = String(payload?.uid || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const planId = Number(payload?.planId);
  if (!uid) throw new Error("uid is required");
  if (!email) throw new Error("email is required");
  if (!Number.isFinite(planId) || planId <= 0) {
    throw new Error("planId is required");
  }

  const plan = await SubscriptionPlanModel.getPlanById(planId);
  if (!plan) throw new Error("Active plan not found");

  // Enforce "do nothing when already subscribed" with both denormalized and source-of-truth checks.
  const docSnap = await subscriptionsCollection.doc(uid).get();
  if (docSnap.exists && isActiveStatus(docSnap.data()?.status)) {
    return { outcome: "already_subscribed", uid };
  }
  const activeFamilyAccess = await FamilyModel.getActiveFamilyAccessForUid(uid);
  if (activeFamilyAccess) {
    return { outcome: "already_subscribed", uid };
  }
  const activeSubscription = await SubscriptionModel.getByUidActive(uid);
  if (activeSubscription) {
    return { outcome: "already_subscribed", uid };
  }

  const expirationDate = payload?.expiresAt ? new Date(payload.expiresAt) : new Date();
  if (!payload?.expiresAt) {
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
  }
  if (Number.isNaN(expirationDate.getTime())) {
    throw new Error("Invalid expiresAt");
  }

  const amountNaira = Number(plan.amount);
  if (!Number.isFinite(amountNaira) || amountNaira < 0) {
    throw new Error("Invalid plan amount");
  }
  const amountKobo = Math.round(amountNaira * 100);
  const reference = buildAdminGrantReference(uid);

  const kind = String(plan.plan_kind || "individual");
  const isFamily =
    kind === "family_regular" ||
    kind === "family_student" ||
    kind.startsWith("family");

  const conn = await db.getConnection();
  let shouldDeleteFirestoreOnRollback = false;
  try {
    await conn.beginTransaction();

    const [insertResult] = await conn.query(
      `INSERT INTO subscriptions (uid, amount, email, status, expiration_date, paystack_ref)
       VALUES (?, ?, ?, 'active', ?, ?)`,
      [uid, amountKobo, email, expirationDate, reference]
    );
    const subscriptionId = Number(insertResult.insertId);
    if (!Number.isFinite(subscriptionId) || subscriptionId <= 0) {
      throw new Error("Could not create subscription");
    }

    let firestorePayload;
    if (isFamily) {
      const planTier =
        kind === "family_student" ? "student_family" : "standard_family";
      const [familyInsert] = await conn.query(
        `INSERT INTO family_groups (owner_uid, subscription_id, status, max_seats, plan_tier, plan_id, expires_at)
         VALUES (?, ?, 'active', 5, ?, ?, ?)`,
        [uid, subscriptionId, planTier, Number(plan.id), expirationDate]
      );
      const familyId = Number(familyInsert.insertId);
      if (!Number.isFinite(familyId) || familyId <= 0) {
        throw new Error("Could not create family group");
      }
      await conn.query(
        `INSERT INTO family_members (family_id, email_normalized, uid, role, status, invite_token_hash, invite_expires_at)
         VALUES (?, ?, ?, 'owner', 'active', NULL, NULL)`,
        [familyId, FamilyModel.normalizeEmail(email), uid]
      );
      firestorePayload = {
        userID: uid,
        email,
        status: "active",
        planKind: "family",
        planCode: plan.plan_code || null,
        plan_kind: kind || null,
        familyId: String(familyId),
        role: "owner",
        familyTier: planTier,
        expiresAt: new Date(expirationDate).toISOString(),
      };
    } else {
      firestorePayload = {
        userID: uid,
        email,
        status: "active",
        planKind: "individual",
        planCode: null,
        plan_kind: null,
        expiresAt: new Date(expirationDate).toISOString(),
      };
    }

    await subscriptionsCollection.doc(uid).set(firestorePayload);
    shouldDeleteFirestoreOnRollback = true;

    try {
      await referralService.convertOnFirstPaidSubscription({
        referredUid: uid,
        subscriptionId,
        executor: conn,
      });
    } catch (e) {
      // Keep current behavior resilient: referral conversion must not block subscription activation.
      console.warn("Referral conversion side-effect failed:", e.message);
    }

    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      // no-op
    }
    if (shouldDeleteFirestoreOnRollback) {
      await subscriptionsCollection.doc(uid).delete().catch(() => {});
    }
    throw e;
  } finally {
    conn.release();
  }

  return { outcome: "granted", uid, planId: plan.id };
}

module.exports = {
  adminRevokeSubscription,
  adminGrantSubscription,
};
