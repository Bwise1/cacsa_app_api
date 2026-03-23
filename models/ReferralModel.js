const db = require("../db/db");

class ReferralModel {
  async getCodeByUid(firebaseUid) {
    const [rows] = await db.query(
      `SELECT id, firebase_uid, code, is_active, created_at, updated_at
       FROM referral_codes
       WHERE firebase_uid = ?
       LIMIT 1`,
      [firebaseUid]
    );
    return rows[0] || null;
  }

  async getCodeRow(code) {
    const [rows] = await db.query(
      `SELECT id, firebase_uid, code, is_active, created_at, updated_at
       FROM referral_codes
       WHERE code = ?
       LIMIT 1`,
      [code]
    );
    return rows[0] || null;
  }

  async createCode(firebaseUid, code) {
    await db.query(
      `INSERT INTO referral_codes (firebase_uid, code, is_active)
       VALUES (?, ?, 1)`,
      [firebaseUid, code]
    );
  }

  async upsertAttribution({
    referredUid,
    referrerUid,
    referralCode,
    status = "pending",
    rejectedReason = null,
  }) {
    await db.query(
      `INSERT INTO referral_attributions
        (referred_uid, referrer_uid, referral_code, status, rejected_reason)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        referrer_uid = VALUES(referrer_uid),
        referral_code = VALUES(referral_code),
        status = VALUES(status),
        rejected_reason = VALUES(rejected_reason),
        converted_at = CASE
          WHEN VALUES(status) = 'converted' THEN CURRENT_TIMESTAMP(3)
          ELSE converted_at
        END`,
      [referredUid, referrerUid, referralCode, status, rejectedReason]
    );
  }

  async getAttributionByReferredUid(referredUid) {
    const [rows] = await db.query(
      `SELECT id, referred_uid, referrer_uid, referral_code, status, captured_at, converted_at, rejected_reason
       FROM referral_attributions
       WHERE referred_uid = ?
       LIMIT 1`,
      [referredUid]
    );
    return rows[0] || null;
  }

  async markConverted(attributionId) {
    await db.query(
      `UPDATE referral_attributions
       SET status = 'converted', converted_at = CURRENT_TIMESTAMP(3), rejected_reason = NULL
       WHERE id = ?`,
      [attributionId]
    );
  }

  async insertConversion({ attributionId, subscriptionId, rewardPoints }) {
    await db.query(
      `INSERT INTO referral_conversions (attribution_id, subscription_id, reward_points)
       VALUES (?, ?, ?)`,
      [attributionId, subscriptionId, rewardPoints]
    );
  }

  async getMeStats(firebaseUid) {
    const [codeRows] = await db.query(
      `SELECT code, is_active, created_at
       FROM referral_codes
       WHERE firebase_uid = ?
       LIMIT 1`,
      [firebaseUid]
    );
    const codeRow = codeRows[0] || null;

    const [aggRows] = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
         COALESCE(SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END), 0) AS converted_count,
         COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_count
       FROM referral_attributions
       WHERE referrer_uid = ?`,
      [firebaseUid]
    );
    const agg = aggRows[0] || {
      pending_count: 0,
      converted_count: 0,
      rejected_count: 0,
    };

    return {
      code: codeRow?.code || null,
      isActive: !!codeRow?.is_active,
      codeCreatedAt: codeRow?.created_at || null,
      pendingCount: Number(agg.pending_count || 0),
      convertedCount: Number(agg.converted_count || 0),
      rejectedCount: Number(agg.rejected_count || 0),
    };
  }

  async listAdminReferrals({ q = "", status = "all", limit = 100 }) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
    const statusFilter =
      status === "pending" || status === "converted" || status === "rejected"
        ? status
        : null;
    const like = `%${String(q || "").trim()}%`;
    const where = [];
    const params = [];

    if (statusFilter) {
      where.push("ra.status = ?");
      params.push(statusFilter);
    }
    if (q && String(q).trim() !== "") {
      where.push("(ra.referral_code LIKE ? OR ra.referrer_uid LIKE ? OR ra.referred_uid LIKE ?)");
      params.push(like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await db.query(
      `SELECT
         ra.id,
         ra.referred_uid,
         ra.referrer_uid,
         ra.referral_code,
         ra.status,
         ra.captured_at,
         ra.converted_at,
         ra.rejected_reason,
         rc.subscription_id,
         rc.reward_points
       FROM referral_attributions ra
       LEFT JOIN referral_conversions rc ON rc.attribution_id = ra.id
       ${whereSql}
       ORDER BY ra.id DESC
       LIMIT ?`,
      [...params, safeLimit]
    );

    const [summaryRows] = await db.query(
      `SELECT
         COUNT(*) AS total_attributions,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
         COALESCE(SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END), 0) AS converted_count,
         COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_count
       FROM referral_attributions`
    );
    const s = summaryRows[0] || {};
    return {
      rows,
      summary: {
        totalAttributions: Number(s.total_attributions || 0),
        pendingCount: Number(s.pending_count || 0),
        convertedCount: Number(s.converted_count || 0),
        rejectedCount: Number(s.rejected_count || 0),
      },
    };
  }
}

module.exports = ReferralModel;
