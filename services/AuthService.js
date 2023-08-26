const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config"); // Secret key for JWT
const UserModel = require("../models/UserModel");

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
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return null; // Invalid credentials
    }

    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, {
      expiresIn: "1h",
    });
    return token;
  }
}

module.exports = AuthService;
