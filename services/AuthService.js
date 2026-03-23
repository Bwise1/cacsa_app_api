const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/UserModel");
const RoleModel = require("../models/RoleModel");
require("dotenv").config();

class AuthService {
  constructor() {
    this.userModel = new UserModel();
    this.roleModel = new RoleModel();
  }

  async registerUser(newUser) {
    const hashedPassword = await bcrypt.hash(newUser.password, 10);
    const viewerId = await this.roleModel.getRoleIdBySlug("viewer");
    const userWithHashedPassword = {
      ...newUser,
      password: hashedPassword,
      role: "viewer",
      role_id: viewerId,
    };
    return this.userModel.createUser(userWithHashedPassword);
  }

  buildAccessToken(user, roleSlug, permissions) {
    return jwt.sign(
      {
        id: user.id,
        role: roleSlug,
        permissions,
        tokenType: "access",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m",
      }
    );
  }

  buildRefreshToken(userId) {
    return jwt.sign(
      {
        id: userId,
        tokenType: "refresh",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES || "7d",
      }
    );
  }

  async authenticateUser(username, password) {
    const user = await this.userModel.getUserByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return null;
    }

    const roleSlug = user.role_slug || user.role || "viewer";
    const permissions = user.role_id
      ? await this.roleModel.getPermissionSlugsForRoleId(user.role_id)
      : [];

    const token = this.buildAccessToken(user, roleSlug, permissions);
    const refreshToken = this.buildRefreshToken(user.id);

    const { password: _pw, role_slug: _rs, ...rest } = user;
    return {
      user: {
        ...rest,
        role: roleSlug,
        permissions,
      },
      token,
      refreshToken,
    };
  }

  /**
   * Exchange a valid refresh JWT for a new access token (and optionally rotate refresh).
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken || typeof refreshToken !== "string") {
      throw new Error("refreshToken required");
    }
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      throw new Error("Invalid or expired refresh token");
    }
    if (decoded.tokenType !== "refresh") {
      throw new Error("Invalid token type");
    }
    const user = await this.userModel.getUserById(decoded.id);
    if (!user) {
      throw new Error("User not found");
    }
    const roleSlug = user.role_slug || user.role || "viewer";
    const permissions = user.role_id
      ? await this.roleModel.getPermissionSlugsForRoleId(user.role_id)
      : [];
    const token = this.buildAccessToken(user, roleSlug, permissions);
    const newRefreshToken = this.buildRefreshToken(user.id);
    return { token, refreshToken: newRefreshToken };
  }
}

module.exports = AuthService;
