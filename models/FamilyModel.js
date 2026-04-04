const db = require("../db/db");
const crypto = require("crypto");

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

exports.normalizeEmail = normalizeEmail;
exports.hashToken = hashToken;

exports.getFamilyByOwnerUid = async (ownerUid) => {
  const [rows] = await db.query(
    "SELECT * FROM family_groups WHERE owner_uid = ? AND status = 'active' LIMIT 1",
    [ownerUid]
  );
  return rows[0] || null;
};

exports.getFamilyById = async (id) => {
  const [rows] = await db.query("SELECT * FROM family_groups WHERE id = ?", [id]);
  return rows[0] || null;
};

exports.getFamilyBySubscriptionId = async (subscriptionId) => {
  const [rows] = await db.query(
    "SELECT * FROM family_groups WHERE subscription_id = ? LIMIT 1",
    [subscriptionId]
  );
  return rows[0] || null;
};

exports.createFamilyGroup = async ({
  ownerUid,
  subscriptionId,
  planTier,
  planId,
  expiresAt,
}) => {
  const [result] = await db.query(
    `INSERT INTO family_groups (owner_uid, subscription_id, status, max_seats, plan_tier, plan_id, expires_at)
     VALUES (?, ?, 'active', 5, ?, ?, ?)`,
    [ownerUid, subscriptionId, planTier, planId, expiresAt]
  );
  return result.insertId;
};

exports.addOwnerMember = async ({ familyId, emailNormalized, uid }) => {
  await db.query(
    `INSERT INTO family_members (family_id, email_normalized, uid, role, status, invite_token_hash, invite_expires_at)
     VALUES (?, ?, ?, 'owner', 'active', NULL, NULL)`,
    [familyId, emailNormalized, uid]
  );
};

exports.countOccupiedSeats = async (familyId) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM family_members
     WHERE family_id = ? AND status IN ('active', 'pending')`,
    [familyId]
  );
  return rows[0]?.c ?? 0;
};

exports.listMembers = async (familyId) => {
  const [rows] = await db.query(
    `SELECT id, email_normalized, uid, role, status, invite_expires_at, student_verified_at
     FROM family_members WHERE family_id = ? ORDER BY role DESC, id ASC`,
    [familyId]
  );
  return rows;
};

exports.findMemberByInviteHash = async (tokenHash) => {
  const [rows] = await db.query(
    `SELECT fm.*, fg.plan_tier, fg.plan_id, fg.status AS family_status, fg.expires_at AS family_expires_at
     FROM family_members fm
     JOIN family_groups fg ON fg.id = fm.family_id
     WHERE fm.invite_token_hash = ? AND fm.status = 'pending'`,
    [tokenHash]
  );
  return rows[0] || null;
};

/** Same join shape as findMemberByInviteHash; for signed-in invitee matching email (no token). */
exports.findPendingMemberForAcceptByEmail = async (emailNormalized) => {
  const [rows] = await db.query(
    `SELECT fm.*, fg.plan_tier, fg.plan_id, fg.status AS family_status, fg.expires_at AS family_expires_at
     FROM family_members fm
     JOIN family_groups fg ON fg.id = fm.family_id
     WHERE fm.email_normalized = ? AND fm.status = 'pending' AND fm.role = 'member'
       AND (fm.invite_expires_at IS NULL OR fm.invite_expires_at > NOW())
     ORDER BY fm.id DESC
     LIMIT 1`,
    [emailNormalized]
  );
  return rows[0] || null;
};

/** Remove the current pending invite for this email (invitee declines). */
exports.declinePendingInviteForEmail = async (emailNormalized) => {
  const pending = await exports.findPendingInviteForEmail(emailNormalized);
  if (!pending) return 0;
  const [result] = await db.query(
    `DELETE FROM family_members WHERE id = ? AND email_normalized = ? AND status = 'pending' AND role = 'member'`,
    [pending.id, emailNormalized]
  );
  return result.affectedRows ?? 0;
};

/** Pending invite row for this email (not yet accepted). */
exports.findPendingInviteForEmail = async (emailNormalized) => {
  const [rows] = await db.query(
    `SELECT fm.id, fm.invite_expires_at, fg.plan_tier, fg.id AS family_id
     FROM family_members fm
     INNER JOIN family_groups fg ON fg.id = fm.family_id AND fg.status = 'active'
     WHERE fm.email_normalized = ? AND fm.status = 'pending'
       AND (fm.invite_expires_at IS NULL OR fm.invite_expires_at > NOW())
     ORDER BY fm.id DESC
     LIMIT 1`,
    [emailNormalized]
  );
  return rows[0] || null;
};

/** Removes stale pending rows so owners can re-invite the same email (unique on family_id+email). */
exports.deleteExpiredPendingInvites = async () => {
  const [result] = await db.query(
    `DELETE FROM family_members
     WHERE status = 'pending'
       AND invite_expires_at IS NOT NULL
       AND invite_expires_at < NOW()`
  );
  return result.affectedRows ?? 0;
};

exports.updateMemberAccepted = async ({
  memberId,
  uid,
  studentVerified,
}) => {
  await db.query(
    `UPDATE family_members SET uid = ?, status = 'active',
     invite_token_hash = NULL, invite_expires_at = NULL,
     student_verified_at = ?
     WHERE id = ?`,
    [uid, studentVerified ? new Date() : null, memberId]
  );
};

exports.createPendingInvite = async ({
  familyId,
  emailNormalized,
  tokenHash,
  inviteExpiresAt,
}) => {
  const [result] = await db.query(
    `INSERT INTO family_members (family_id, email_normalized, uid, role, status, invite_token_hash, invite_expires_at)
     VALUES (?, ?, NULL, 'member', 'pending', ?, ?)`,
    [familyId, emailNormalized, tokenHash, inviteExpiresAt]
  );
  return result.insertId;
};

exports.removeMemberByUid = async (familyId, targetUid, ownerUid) => {
  const [fam] = await db.query(
    "SELECT owner_uid FROM family_groups WHERE id = ?",
    [familyId]
  );
  if (!fam[0] || fam[0].owner_uid !== ownerUid) {
    throw new Error("Forbidden");
  }
  await db.query(
    `DELETE FROM family_members WHERE family_id = ? AND uid = ? AND role = 'member'`,
    [familyId, targetUid]
  );
};

exports.revokePendingByEmail = async (familyId, emailNormalized, ownerUid) => {
  const [fam] = await db.query(
    "SELECT owner_uid FROM family_groups WHERE id = ?",
    [familyId]
  );
  if (!fam[0] || fam[0].owner_uid !== ownerUid) {
    throw new Error("Forbidden");
  }
  await db.query(
    `DELETE FROM family_members WHERE family_id = ? AND email_normalized = ? AND status = 'pending'`,
    [familyId, emailNormalized]
  );
};

exports.getMemberByFamilyAndUid = async (familyId, uid) => {
  const [rows] = await db.query(
    "SELECT * FROM family_members WHERE family_id = ? AND uid = ?",
    [familyId, uid]
  );
  return rows[0] || null;
};

exports.getFamilyMemberUids = async (familyId) => {
  const [rows] = await db.query(
    "SELECT uid FROM family_members WHERE family_id = ? AND uid IS NOT NULL AND status = 'active'",
    [familyId]
  );
  return rows.map((r) => r.uid);
};

/**
 * Active family access for Firestore sync: owner (has Paystack subscription row) or member (may not).
 * @returns {Promise<null | {
 *   role: 'owner'|'member',
 *   family_id: number,
 *   plan_tier: string,
 *   expires_at: Date,
 *   plan_code: string|null,
 *   plan_kind: string|null,
 *   member_email: string|null
 * }>}
 */
exports.getActiveFamilyAccessForUid = async (uid) => {
  const [owners] = await db.query(
    `SELECT fg.id AS family_id, fg.plan_tier, fg.expires_at,
            sp.plan_code, sp.plan_kind
     FROM family_groups fg
     INNER JOIN subscription_plans sp ON sp.id = fg.plan_id
     WHERE fg.owner_uid = ? AND fg.status = 'active'
     LIMIT 1`,
    [uid]
  );
  if (owners[0]) {
    return {
      role: "owner",
      family_id: owners[0].family_id,
      plan_tier: owners[0].plan_tier,
      expires_at: owners[0].expires_at,
      plan_code: owners[0].plan_code ?? null,
      plan_kind: owners[0].plan_kind ?? null,
      member_email: null,
    };
  }

  const [members] = await db.query(
    `SELECT fg.id AS family_id, fg.plan_tier, fg.expires_at,
            sp.plan_code, sp.plan_kind, fm.email_normalized AS member_email
     FROM family_members fm
     INNER JOIN family_groups fg ON fg.id = fm.family_id AND fg.status = 'active'
     INNER JOIN subscription_plans sp ON sp.id = fg.plan_id
     WHERE fm.uid = ? AND fm.status = 'active'
     LIMIT 1`,
    [uid]
  );
  if (!members[0]) return null;
  return {
    role: "member",
    family_id: members[0].family_id,
    plan_tier: members[0].plan_tier,
    expires_at: members[0].expires_at,
    plan_code: members[0].plan_code ?? null,
    plan_kind: members[0].plan_kind ?? null,
    member_email: members[0].member_email || null,
  };
};
