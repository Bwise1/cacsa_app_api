const connection = require("../db/db"); // Your database connection

class UserModel {
  async createUser(user) {
    const query =
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)";
    const values = [user.username, user.email, user.password, user.role];

    const [result] = await connection.promise().query(query, values);
    return result.insertId; // ID of the created user
  }

  async getAllUsers() {
    const query = "SELECT * FROM users";
    const [rows] = await connection.promise().query(query);
    return rows;
  }

  async getUserById(id) {
    const query = "SELECT * FROM users WHERE id = ?";
    const [rows] = await connection.promise().query(query, [id]);
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

    const [result] = await connection.promise().query(query, values);
    if (result.affectedRows > 0) {
      return true;
    }
    return false; // User not found or not updated
  }

  async deleteUser(id) {
    const query = "DELETE FROM users WHERE id = ?";
    const [result] = await connection.promise().query(query, [id]);
    if (result.affectedRows > 0) {
      return true;
    }
    return false; // User not found or not deleted
  }
}

module.exports = UserModel;
