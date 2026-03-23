const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const RoleModel = require("../models/RoleModel");
const UserModel = require("../models/UserModel");
const AdminInvitationModel = require("../models/AdminInvitationModel");

const INVITE_EXPIRY_DAYS = 7;

class AdminService {
  constructor() {
    this.roleModel = new RoleModel();
    this.userModel = new UserModel();
    this.invitationModel = new AdminInvitationModel();
  }

  async listRolesDetailed() {
    const roles = await this.roleModel.listRoles();
    const permissions = await this.roleModel.listPermissions();
    const withPerms = await Promise.all(
      roles.map(async (r) => ({
        ...r,
        permissionIds: await this.roleModel.getPermissionIdsForRoleId(r.id),
      }))
    );
    return { roles: withPerms, permissions };
  }

  async createRole({ slug, name, permissionIds }) {
    const id = await this.roleModel.createRole({ slug, name });
    if (permissionIds?.length) {
      await this.roleModel.setRolePermissions(id, permissionIds);
    }
    return id;
  }

  async updateRole(roleId, { name, slug }) {
    const role = await this.roleModel.getRoleById(roleId);
    if (!role) throw new Error("Role not found");
    if (role.slug === "super_admin" && slug && slug !== "super_admin") {
      throw new Error("Cannot rename super_admin role");
    }
    await this.roleModel.updateRole(roleId, { name, slug });
  }

  async deleteRole(roleId) {
    const role = await this.roleModel.getRoleById(roleId);
    if (!role) throw new Error("Role not found");
    if (role.slug === "super_admin") {
      throw new Error("Cannot delete super_admin role");
    }
    const n = await this.roleModel.countUsersWithRole(roleId);
    if (n > 0) {
      throw new Error("Cannot delete role that is assigned to users");
    }
    await this.roleModel.deleteRole(roleId);
  }

  async setRolePermissions(roleId, permissionIds) {
    const role = await this.roleModel.getRoleById(roleId);
    if (!role) throw new Error("Role not found");
    if (role.slug === "super_admin") {
      const allPerms = await this.roleModel.listPermissions();
      const slugSet = new Set(
        permissionIds
          .map((pid) => allPerms.find((x) => x.id === pid)?.slug)
          .filter(Boolean)
      );
      if (!slugSet.has("admin:manage_roles") || !slugSet.has("admin:invite")) {
        throw new Error(
          "super_admin role must retain admin:manage_roles and admin:invite"
        );
      }
    }
    await this.roleModel.setRolePermissions(roleId, permissionIds);
  }

  async createInvitation({ email, roleId, createdByUserId }) {
    const role = await this.roleModel.getRoleById(roleId);
    if (!role) throw new Error("Role not found");
    if (role.slug === "super_admin") {
      throw new Error("Cannot invite super_admin via API");
    }
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
    await this.invitationModel.create({
      email: email.trim().toLowerCase(),
      roleId,
      tokenHash,
      expiresAt,
      createdByUserId,
    });
    return { token, expiresAt };
  }

  async listInvitations() {
    return this.invitationModel.listPending();
  }

  async revokeInvitation(id) {
    const ok = await this.invitationModel.revoke(id);
    if (!ok) throw new Error("Invitation not found or already used");
  }

  async acceptInvitation({ token, password, username }) {
    if (!token || !password || !username) {
      throw new Error("token, password, and username are required");
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const inv = await this.invitationModel.findByTokenHash(tokenHash);
    if (!inv || inv.revoked_at || inv.accepted_at) {
      throw new Error("Invalid or expired invitation");
    }
    if (new Date(inv.expires_at) < new Date()) {
      throw new Error("Invitation has expired");
    }
    const email = inv.email.toLowerCase();
    if (await this.userModel.doesUsernameExist(username)) {
      throw new Error("Username already taken");
    }
    const existing = await this.userModel.getUserByEmail(email);
    if (existing) {
      throw new Error("An account with this email already exists");
    }
    const hashed = await bcrypt.hash(password, 10);
    await this.userModel.createUser({
      username,
      email,
      password: hashed,
      role_id: inv.role_id,
      role: inv.role_slug,
    });
    await this.invitationModel.markAccepted(inv.id);
    return { ok: true };
  }


  async assertCanDeleteAdmin(userId) {
    const user = await this.userModel.getUserById(userId);
    if (!user) return;
    const current = await this.roleModel.getRoleById(user.role_id);
    if (!current || current.slug !== "super_admin") return;
    const count = await this.roleModel.countSuperAdmins();
    if (count <= 1 && user.username === "admin") {
      throw new Error(
        "Cannot delete the primary admin account while it is the only super_admin"
      );
    }
  }

  async assertNotLastSuperAdmin(userId, newRoleId) {
    const user = await this.userModel.getUserById(userId);
    if (!user) return;
    const current = await this.roleModel.getRoleById(user.role_id);
    if (!current || current.slug !== "super_admin") return;
    const target = await this.roleModel.getRoleById(newRoleId);
    if (target && target.slug === "super_admin") return;
    const count = await this.roleModel.countSuperAdmins();
    if (count <= 1 && user.username === "admin") {
      throw new Error(
        "Cannot demote the primary admin account while it is the only super_admin"
      );
    }
  }
}

module.exports = AdminService;
