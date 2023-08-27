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
    // Check if the username or email already exists
    if (await this.doesUsernameExist(username)) {
      throw new Error("Username already exists.");
    }

    if (await this.doesEmailExist(email)) {
      throw new Error("Email already exists.");
    }

    const query =
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)";
    const values = [user.username, user.email, user.password, user.role];

    const [result] = await db.query(query, values);
    return result.insertId; // ID of the created user
  }

  async getAllUsers() {
    const query = "SELECT * FROM users";
    const [rows] = await db.query(query);
    return rows;
  }

  async getUserById(id) {
    const query = "SELECT * FROM users WHERE id = ?";
    const [rows] = await db.query(query, [id]);
    return rows[0]; // Return the first row (user) or null if not found
  }

  async getUserByUsername(username) {
    const query = "SELECT * FROM users WHERE username = ?";
    const [rows] = await db.query(query, [username]);
    return rows[0]; // Return the first row (user) or null if not found
  }

  async updateUser(id, updatedUser) {
    const query =
      "UPDATE users SET username = ?, email = ?, password = ?, role = ? WHERE id = ?";
    const values = [
      updatedUser.username,
      updatedUser.email,
      updatedUser.password,
      updatedUser.role,
      id,
    ];

    const [result] = await db.query(query, values);
    if (result.affectedRows > 0) {
      return true;
    }
    return false; // User not found or not updated
  }

  async deleteUser(id) {
    const query = "DELETE FROM users WHERE id = ?";
    const [result] = await db.query(query, [id]);
    if (result.affectedRows > 0) {
      return true;
    }
    return false; // User not found or not deleted
  }
}

module.exports = UserModel;
