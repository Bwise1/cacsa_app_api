const db = require("../db/db");

class AdminInvitationModel {
  async create({
    email,
    roleId,
    tokenHash,
    expiresAt,
    createdByUserId,
  }) {
    const [result] = await db.query(
      `INSERT INTO admin_invitations (email, role_id, token_hash, expires_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [email, roleId, tokenHash, expiresAt, createdByUserId]
    );
    return result.insertId;
  }

  async findByTokenHash(tokenHash) {
    const [rows] = await db.query(
      `SELECT i.*, r.slug AS role_slug FROM admin_invitations i
       INNER JOIN roles r ON r.id = i.role_id
       WHERE i.token_hash = ?`,
      [tokenHash]
    );
    return rows[0] ?? null;
  }

  async listPending() {
    const [rows] = await db.query(
      `SELECT i.id, i.email, i.role_id, i.expires_at, i.created_at, i.created_by_user_id,
              r.slug AS role_slug, r.name AS role_name
       FROM admin_invitations i
       INNER JOIN roles r ON r.id = i.role_id
       WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL
       ORDER BY i.created_at DESC`
    );
    return rows;
  }

  async revoke(id) {
    const [result] = await db.query(
      "UPDATE admin_invitations SET revoked_at = NOW() WHERE id = ? AND accepted_at IS NULL",
      [id]
    );
    return result.affectedRows > 0;
  }

  async markAccepted(id) {
    const [result] = await db.query(
      "UPDATE admin_invitations SET accepted_at = NOW() WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = AdminInvitationModel;
