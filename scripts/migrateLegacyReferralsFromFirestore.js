/**
 * Optional one-time migration utility.
 *
 * Reads legacy Firestore `referrals` documents and inserts rows into MySQL:
 * - referral_codes
 * - referral_attributions
 * - referral_conversions (for converted rows with subscription_id)
 *
 * Required env:
 *   DB_HOST, DB_USER, DB_NAME, (DB_PASSWORD optional), DB_PORT optional
 *   GOOGLE_APPLICATION_CREDENTIALS or firebase-admin env initialization
 *
 * Usage:
 *   npm run migrate:referrals-firestore
 */
const db = require("../db/db");
const { admin } = require("../utils/firebase");

async function ensureCode(firebaseUid, code) {
  const cleanedCode = String(code || "").trim().toUpperCase();
  if (!cleanedCode) return null;
  await db.query(
    `INSERT INTO referral_codes (firebase_uid, code, is_active)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE
      firebase_uid = VALUES(firebase_uid),
      is_active = VALUES(is_active)`,
    [firebaseUid, cleanedCode]
  );
  return cleanedCode;
}

async function migrateDoc(data) {
  const referredUid = String(data.referred_uid || data.referredUid || "").trim();
  const referrerUid = String(data.referrer_uid || data.referrerUid || "").trim();
  const code = String(data.referral_code || data.code || "").trim().toUpperCase();
  const statusRaw = String(data.status || "pending").toLowerCase();
  const status =
    statusRaw === "converted" || statusRaw === "rejected" ? statusRaw : "pending";

  if (!referredUid || !referrerUid || !code) {
    return { migrated: false, reason: "missing_fields" };
  }

  const normalizedCode = await ensureCode(referrerUid, code);
  await db.query(
    `INSERT INTO referral_attributions
      (referred_uid, referrer_uid, referral_code, status, rejected_reason, converted_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      referrer_uid = VALUES(referrer_uid),
      referral_code = VALUES(referral_code),
      status = VALUES(status),
      rejected_reason = VALUES(rejected_reason),
      converted_at = VALUES(converted_at)`,
    [
      referredUid,
      referrerUid,
      normalizedCode,
      status,
      data.rejected_reason || data.rejectedReason || null,
      status === "converted" ? new Date() : null,
    ]
  );

  if (status === "converted" && data.subscription_id != null) {
    const [rows] = await db.query(
      `SELECT id FROM referral_attributions WHERE referred_uid = ? LIMIT 1`,
      [referredUid]
    );
    const attributionId = rows[0]?.id;
    if (attributionId) {
      await db.query(
        `INSERT INTO referral_conversions
          (attribution_id, subscription_id, reward_points)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE reward_points = VALUES(reward_points)`,
        [
          attributionId,
          Number(data.subscription_id),
          Number(data.reward_points || 100),
        ]
      );
    }
  }

  return { migrated: true };
}

async function main() {
  const snap = await admin.firestore().collection("referrals").get();
  let ok = 0;
  let skipped = 0;
  for (const doc of snap.docs) {
    try {
      const r = await migrateDoc(doc.data() || {});
      if (r.migrated) ok += 1;
      else skipped += 1;
    } catch (e) {
      console.error("Failed doc", doc.id, e.message);
      skipped += 1;
    }
  }
  console.log(`Migration done. migrated=${ok} skipped=${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  });
