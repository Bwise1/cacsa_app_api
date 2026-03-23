const SubscriptionModel = require("../models/SubscriptionModel");
const FamilyModel = require("../models/FamilyModel");
const { syncSubscriptionToFirestore } = require("./subscriptionFirestoreSyncService");
const { ReferralService } = require("./ReferralService");

const referralService = new ReferralService();

/**
 * Paystack verify response `data` object (transaction).
 */
function extractMetadata(paystackTransactionData) {
  const meta = paystackTransactionData?.metadata;
  if (!meta || typeof meta !== "object") return {};
  return meta;
}

/**
 * After MySQL subscription row is set to active, mirror Firestore (+ family rows when applicable).
 * @param {string} reference Paystack reference
 * @param {object} paystackTransactionData `data` from verify response or webhook payload.data
 */
async function activateSubscriptionSideEffects(reference, paystackTransactionData) {
  const subRow = await SubscriptionModel.getByPaystackRef(reference);
  if (!subRow) {
    throw new Error("Subscription not found for reference");
  }

  const metadata = extractMetadata(paystackTransactionData);
  const uid = metadata.uid || subRow.uid;
  const email = metadata.email || subRow.email;

  const planType = metadata.plan_type || "";
  const planKind = metadata.plan_kind || "";

  const isFamily =
    planType === "family" ||
    String(planKind).startsWith("family") ||
    planKind === "family_regular" ||
    planKind === "family_student";

  try {
    await referralService.convertOnFirstPaidSubscription({
      referredUid: uid,
      subscriptionId: subRow.id,
    });
  } catch (e) {
    console.warn("Referral conversion side-effect failed:", e.message);
  }

  if (isFamily) {
    const existingFam = await FamilyModel.getFamilyBySubscriptionId(subRow.id);
    if (existingFam) {
      await syncSubscriptionToFirestore(uid);
      return {
        kind: "family",
        familyId: existingFam.id,
        alreadyExisted: true,
      };
    }

    const planTier =
      metadata.plan_tier === "student_family"
        ? "student_family"
        : "standard_family";
    const planId = parseInt(metadata.plan_id, 10) || 0;

    const familyId = await FamilyModel.createFamilyGroup({
      ownerUid: uid,
      subscriptionId: subRow.id,
      planTier,
      planId,
      expiresAt: subRow.expiration_date,
    });

    await FamilyModel.addOwnerMember({
      familyId,
      emailNormalized: FamilyModel.normalizeEmail(email),
      uid,
    });

    await syncSubscriptionToFirestore(uid);
    return { kind: "family", familyId, alreadyExisted: false };
  }

  await syncSubscriptionToFirestore(uid);
  return { kind: "individual" };
}

module.exports = {
  extractMetadata,
  activateSubscriptionSideEffects,
};
