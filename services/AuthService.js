const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/UserModel");
require("dotenv").config();

class AuthService {
  constructor() {
    this.userModel = new UserModel();
  }

  async registerUser(newUser) {
    const hashedPassword = await bcrypt.hash(newUser.password, 10);
    const userWithHashedPassword = { ...newUser, password: hashedPassword };
    return this.userModel.createUser(userWithHashedPassword);
  }

  async authenticateUser(username, password) {
    const user = await this.userModel.getUserByUsername(username);
    console.info(user);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return null; // Invalid credentials
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    return { user, token };
  }
}

module.exports = AuthService;
