const db = require("../db/db"); // Your exported database connection with promise support

class UserModel {
  async doesUsernameExist(username) {
    const query = "SELECT COUNT(*) AS count FROM users WHERE username = ?";
    const [rows] = await db.query(query, [username]);
    const count = rows[0].count;
    return count > 0;
  }

  async doesEmailExist(email) {
    const query = "SELECT COUNT(*) AS count FROM users WHERE email = ?";
    const [rows] = await db.query(query, [email]);
    const count = rows[0].count;
    return count > 0;
  }

  async createUser(user) {
    if (await this.doesUsernameExist(user.username)) {
      throw new Error("Username already exists.");
    }

    if (await this.doesEmailExist(user.email)) {
      throw new Error("Email already exists.");
    }

    const query =
      "INSERT INTO users (username, email, password, role, role_id) VALUES (?, ?, ?, ?, ?)";
    const values = [
      user.username,
      user.email,
      user.password,
      user.role ?? "viewer",
      user.role_id ?? null,
    ];

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  async countAdminUsers() {
    const [rows] = await db.query("SELECT COUNT(*) AS c FROM users");
    return Number(rows[0]?.c ?? 0);
  }


  async listAdminUsers() {
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.role_id,
              r.slug AS role_slug, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.id DESC`
    );
    return rows;
  }

  async updateUserRole(userId, roleId, roleSlug) {
    const [result] = await db.query(
      "UPDATE users SET role_id = ?, role = ? WHERE id = ?",
      [roleId, roleSlug, userId]
    );
    return result.affectedRows > 0;
  }

  async getAllUsers() {
    const query = "SELECT * FROM users";
    const [rows] = await db.query(query);
    return rows;
  }

  async getUserById(id) {
    const query = `
      SELECT u.*, r.slug AS role_slug
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  async getUserByUsername(username) {
    const query = `
      SELECT u.*, r.slug AS role_slug
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.username = ?
    `;
    const [rows] = await db.query(query, [username]);
    return rows[0];
  }

  async getUserByEmail(email) {
    const query = `
      SELECT u.*, r.slug AS role_slug
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
    `;
    const [rows] = await db.query(query, [email]);
    return rows[0];
  }

  async updateUser(id, updatedUser) {
    const query =
      "UPDATE users SET username = ?, email = ?, password = ?, role = ?, role_id = ? WHERE id = ?";
    const values = [
      updatedUser.username,
      updatedUser.email,
      updatedUser.password,
      updatedUser.role,
      updatedUser.role_id ?? null,
      id,
    ];

    const [result] = await db.query(query, values);
    if (result.affectedRows > 0) {
      return true;
    }
    return false;
  }

  async deleteUser(id) {
    const query = "DELETE FROM users WHERE id = ?";
    const [result] = await db.query(query, [id]);
    if (result.affectedRows > 0) {
      return true;
    }
    return false;
  }
}

module.exports = UserModel;
