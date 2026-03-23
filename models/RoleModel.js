const db = require("../db/db");

class RoleModel {
  async getRoleIdBySlug(slug) {
    const [rows] = await db.query("SELECT id FROM roles WHERE slug = ?", [slug]);
    return rows[0]?.id ?? null;
  }

  async getRoleById(id) {
    const [rows] = await db.query("SELECT * FROM roles WHERE id = ?", [id]);
    return rows[0] ?? null;
  }

  async getRoleBySlug(slug) {
    const [rows] = await db.query("SELECT * FROM roles WHERE slug = ?", [slug]);
    return rows[0] ?? null;
  }

  async listRoles() {
    const [rows] = await db.query(
      "SELECT id, slug, name, created_at FROM roles ORDER BY slug ASC"
    );
    return rows;
  }

  async listPermissions() {
    const [rows] = await db.query(
      "SELECT id, slug, description FROM permissions ORDER BY slug ASC"
    );
    return rows;
  }

  async getPermissionSlugsForRoleId(roleId) {
    if (!roleId) return [];
    const [rows] = await db.query(
      `SELECT p.slug FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [roleId]
    );
    return rows.map((r) => r.slug);
  }

  async getPermissionIdsForRoleId(roleId) {
    if (!roleId) return [];
    const [rows] = await db.query(
      "SELECT permission_id FROM role_permissions WHERE role_id = ?",
      [roleId]
    );
    return rows.map((r) => r.permission_id);
  }

  async setRolePermissions(roleId, permissionIds) {
    await db.query("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);
    if (!permissionIds?.length) return;
    for (const pid of permissionIds) {
      await db.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
        [roleId, pid]
      );
    }
  }

  async createRole({ slug, name }) {
    const [result] = await db.query(
      "INSERT INTO roles (slug, name) VALUES (?, ?)",
      [slug, name]
    );
    return result.insertId;
  }

  async updateRole(id, { name, slug }) {
    const fields = [];
    const vals = [];
    if (name != null) {
      fields.push("name = ?");
      vals.push(name);
    }
    if (slug != null) {
      fields.push("slug = ?");
      vals.push(slug);
    }
    if (!fields.length) return false;
    vals.push(id);
    const [result] = await db.query(
      `UPDATE roles SET ${fields.join(", ")} WHERE id = ?`,
      vals
    );
    return result.affectedRows > 0;
  }

  async deleteRole(id) {
    const [result] = await db.query("DELETE FROM roles WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }

  async countUsersWithRole(roleId) {
    const [rows] = await db.query(
      "SELECT COUNT(*) AS c FROM users WHERE role_id = ?",
      [roleId]
    );
    return rows[0].c;
  }

  async countSuperAdmins() {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS c FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.slug = 'super_admin'`
    );
    return rows[0].c;
  }
}

module.exports = RoleModel;
