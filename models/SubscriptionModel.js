const db = require("../db/db");

exports.getAllSubscriptions = async () => {
  try {
    const [subscriptions] = await db.query("SELECT * FROM subscriptions");
    return subscriptions;
  } catch (error) {
    throw new Error("Error fetching subscriptions");
  }
};

exports.addSubscription = async (
  uid,
  amount,
  email,
  paystackRef,
  expirationDate
) => {
  try {
    const result = await db.query(
      "INSERT INTO subscriptions (uid, amount, email, status, expiration_date, paystack_ref) VALUES (?, ?, ?, 'inactive', ?, ?)",
      [uid, amount, email, expirationDate, paystackRef]
    );

    return result.insertId;
  } catch (error) {
    console.error("Error", error);
    throw new Error("Error adding subscription");
  }
};

exports.updateSubscriptionStatus = async (paystackRef, newStatus) => {
  try {
    await db.query(
      "UPDATE subscriptions SET status = ? WHERE paystack_ref = ?",
      [newStatus, paystackRef]
    );

    const [rows] = await db.query(
      "SELECT * FROM subscriptions WHERE paystack_ref = ?",
      [paystackRef]
    );

    return rows[0];
  } catch (error) {
    throw new Error("Error updating subscription status");
  }
};

exports.updateExpiredSubscriptions = async () => {
  try {
    const result = await db.query(
      "UPDATE subscriptions SET status = 'expired' WHERE expiration_date < NOW()"
    );

    return result.affectedRows;
  } catch (error) {
    throw new Error("Error updating expired subscriptions");
  }
};

exports.getExpiredSubscriptions = async () => {
  try {
    const [rows] = await db.query(
      "SELECT uid FROM subscriptions WHERE expiration_date < NOW() AND status != 'expired'"
    );
    console.log("Rows", rows);
    return rows;
  } catch (error) {
    console.log("Error", error);
    throw new Error("Error getting expired subscriptions");
  }
};

/** Returns id + uid for each subscription row that should expire (used by cron). */
exports.getExpiredSubscriptionRows = async () => {
  const [rows] = await db.query(
    "SELECT id, uid FROM subscriptions WHERE expiration_date < NOW() AND status != 'expired'"
  );
  return rows;
};

exports.getAllActiveSubscriptions = async () => {
  try {
    const [rows] = await db.query(
      "SELECT uid FROM subscriptions WHERE status= 'active'"
    );
    console.log("Rows", rows);
    return rows;
  } catch (error) {
    console.log("Error", error);
    throw new Error("Error getting expired subscriptions");
  }
};

exports.getByPaystackRef = async (paystackRef) => {
  const [rows] = await db.query(
    "SELECT * FROM subscriptions WHERE paystack_ref = ? LIMIT 1",
    [paystackRef]
  );
  return rows[0] || null;
};

exports.getByUidActive = async (uid) => {
  const [rows] = await db.query(
    "SELECT * FROM subscriptions WHERE uid = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
    [uid]
  );
  return rows[0] || null;
};

exports.getActiveByEmail = async (email) => {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  const [rows] = await db.query(
    "SELECT * FROM subscriptions WHERE LOWER(TRIM(email)) = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
    [normalized]
  );
  return rows[0] || null;
};

/**
 * Admin app users: map Firebase uid -> MySQL-backed plan labels (family owner/member + subscription_plans).
 * Individual-only Paystack rows without family_groups are omitted (use Firestore subscriptionInfo).
 * @param {string[]} uids
 * @returns {Promise<Map<string, { planKind: string, planName: string, planTier: string|null }>>}
 */
exports.getPlanLabelsForUids = async (uids) => {
  const map = new Map();
  const uniq = [...new Set((uids || []).filter(Boolean))];
  if (!uniq.length) return map;

  try {
  const placeholders = uniq.map(() => "?").join(",");

  const [owners] = await db.query(
    `SELECT fg.owner_uid AS uid, sp.plan_kind AS plan_kind, sp.name AS plan_name, fg.plan_tier AS plan_tier
     FROM family_groups fg
     INNER JOIN subscription_plans sp ON sp.id = fg.plan_id
     WHERE fg.owner_uid IN (${placeholders}) AND fg.status = 'active'`,
    uniq
  );
  for (const r of owners) {
    map.set(r.uid, {
      planKind: r.plan_kind || "individual",
      planName: r.plan_name || "",
      planTier: r.plan_tier || null,
    });
  }

  const [members] = await db.query(
    `SELECT fm.uid AS uid, sp.plan_kind AS plan_kind, sp.name AS plan_name, fg.plan_tier AS plan_tier
     FROM family_members fm
     INNER JOIN family_groups fg ON fg.id = fm.family_id AND fg.status = 'active'
     INNER JOIN subscription_plans sp ON sp.id = fg.plan_id
     WHERE fm.uid IN (${placeholders}) AND fm.status = 'active'`,
    uniq
  );
  for (const r of members) {
    if (!map.has(r.uid)) {
      map.set(r.uid, {
        planKind: r.plan_kind || "individual",
        planName: r.plan_name || "",
        planTier: r.plan_tier || null,
      });
    }
  }

  return map;
  } catch (e) {
    console.error("getPlanLabelsForUids:", e.message);
    return map;
  }
};
