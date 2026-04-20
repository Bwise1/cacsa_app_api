const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const requirePermission = require("../middlewares/requirePermission");
const { requireAnyPermission } = require("../middlewares/requirePermission");
const AdminService = require("../services/AdminService");
const RoleModel = require("../models/RoleModel");
const AudioPlayModel = require("../models/AudioPlayModel");
const { sendBroadcast } = require("../services/NotificationBroadcastService");
const { sendAdminInviteEmail } = require("../utils/emailService");
const { getOverviewMetrics } = require("../services/overviewMetricsService");
const appUsersAdminService = require("../services/appUsersAdminService");
const adminSubscriptionService = require("../services/adminSubscriptionService");
const SubscriptionPlanModel = require("../models/SubscriptionPlanModel");
const studentCodeAdminService = require("../services/studentCodeAdminService");
const UserModel = require("../models/UserModel");
const AdModel = require("../models/AdModel");
const { AdService } = require("../services/AdService");
const { ReferralService } = require("../services/ReferralService");
const { DevotionalService } = require("../services/DevotionalService");
const { upload } = require("../utils/aws");

const router = express.Router();
const adminService = new AdminService();
const roleModel = new RoleModel();
const audioPlayModel = new AudioPlayModel();
const userModel = new UserModel();
const adModel = new AdModel();
const adService = new AdService();
const referralService = new ReferralService();
const devotionalService = new DevotionalService();
const hymnStorageService = require("../services/hymnStorageService");
const ytStreamAdminService = require("../services/ytStreamAdminService");
const broadcastNotificationsAdminService = require("../services/broadcastNotificationsAdminService");
const { db: firestoreDb } = require("../utils/firebase/index");

const APP_CONFIG_COLLECTION = "appConfig";
const MOBILE_UPDATE_DOC = "mobile_update";

/** Public: accept invitation */
router.post("/invitations/accept", async (req, res) => {
  try {
    const { token, password, username } = req.body;
    await adminService.acceptInvitation({ token, password, username });
    res.status(201).json({ status: "success", message: "Account created" });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
});

/** Public: check if admin username is already taken (invite flow). */
router.post("/invitations/check-username", async (req, res) => {
  try {
    const { username } = req.body ?? {};
    if (username == null || typeof username !== "string") {
      return res.status(400).json({ status: "error", message: "username required" });
    }
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      return res.json({ status: "success", available: false });
    }
    const taken = await userModel.doesUsernameExist(trimmed);
    res.json({ status: "success", available: !taken });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.use(authMiddleware);

/** Hymn bundle JSON in Firebase Storage (Flutter sync). Same permission model as admin hymns UI. */
router.get(
  "/hymns/bundle",
  requireAnyPermission("hymns:write", "admin:analytics"),
  async (req, res) => {
    try {
      const data = await hymnStorageService.getBundle();
      res.json(data);
    } catch (error) {
      console.error("GET /admin/hymns/bundle:", error);
      res.status(500).json({
        error: "Failed to load bundle",
        hint: error.message,
      });
    }
  }
);

router.put(
  "/hymns/bundle",
  requireAnyPermission("hymns:write", "admin:analytics"),
  async (req, res) => {
    try {
      const bundle = req.body?.bundle;
      const publish = req.body?.publish === true;
      if (!bundle) {
        return res.status(400).json({ error: "bundle required" });
      }
      const result = publish
        ? await hymnStorageService.publishBundle(bundle)
        : await hymnStorageService.saveDraft(bundle);
      res.json(result);
    } catch (error) {
      if (error.code === "INVALID_BUNDLE") {
        return res.status(400).json({ error: "Invalid bundle" });
      }
      console.error("PUT /admin/hymns/bundle:", error);
      res.status(500).json({
        error: "Save failed",
        hint: error.message,
      });
    }
  }
);

/** Promote draft (or re-publish live) to apps — bumps syncVersion once. Body optional. */
router.post(
  "/hymns/publish",
  requireAnyPermission("hymns:write", "admin:analytics"),
  async (req, res) => {
    try {
      const result = await hymnStorageService.publishBundle();
      res.json(result);
    } catch (error) {
      if (error.code === "NOTHING_TO_PUBLISH") {
        return res.status(400).json({ error: "Nothing to publish" });
      }
      if (error.code === "INVALID_BUNDLE") {
        return res.status(400).json({ error: "Invalid bundle" });
      }
      console.error("POST /admin/hymns/publish:", error);
      res.status(500).json({
        error: "Publish failed",
        hint: error.message,
      });
    }
  }
);

router.get(
  "/hymns/manifest",
  requireAnyPermission("hymns:write", "admin:analytics"),
  async (req, res) => {
    try {
      const data = await hymnStorageService.getManifest();
      res.json(data);
    } catch (error) {
      console.error("GET /admin/hymns/manifest:", error);
      res.status(500).json({
        error: "Failed to load manifest",
        hint: error.message,
      });
    }
  }
);

/** Org-wide KPIs: admin users, subscribers, audio library, Firebase registered (approx), GA4 optional. */
router.get(
  "/overview-metrics",
  requirePermission("admin:analytics"),
  async (req, res) => {
    try {
      const data = await getOverviewMetrics();
      res.json({ status: "success", ...data });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

/** Same KPI subset for Users page (user:read only — no admin:analytics required). */
router.get(
  "/users-stats",
  requirePermission("user:read"),
  async (req, res) => {
    try {
      const data = await getOverviewMetrics();
      res.json({
        status: "success",
        firebaseRegisteredUsers: data.firebaseRegisteredUsers,
        firebaseRegisteredApproximate: data.firebaseRegisteredApproximate,
        activeSubscribers: data.activeSubscribers,
        subscriptionDocumentsTotal: data.subscriptionDocumentsTotal,
        ga4Configured: data.ga4Configured,
        activeUsersMonth: data.activeUsersMonth,
        activeUsersToday: data.activeUsersToday,
        activeUsersLast30Min: data.activeUsersLast30Min,
        ga4Error: data.ga4Error,
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/mobile-update-config",
  requirePermission("admin:manage_app_update"),
  async (req, res) => {
    try {
      const snap = await firestoreDb
        .collection(APP_CONFIG_COLLECTION)
        .doc(MOBILE_UPDATE_DOC)
        .get();
      const d = snap.exists ? snap.data() || {} : {};
      res.json({
        status: "success",
        config: {
          enabled: d.enabled !== false,
          latest_version: d.latest_version ?? "",
          latest_build: d.latest_build ?? null,
          min_supported_build: d.min_supported_build ?? null,
          ios_latest_build: d.ios_latest_build ?? null,
          ios_min_supported_build: d.ios_min_supported_build ?? null,
          message: d.message ?? "",
          update_url: d.update_url ?? "",
          ios_url: d.ios_url ?? "",
          android_url: d.android_url ?? "",
          updated_at: d.updated_at ?? null,
          updated_by: d.updated_by ?? null,
        },
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.put(
  "/mobile-update-config",
  requirePermission("admin:manage_app_update"),
  async (req, res) => {
    try {
      const body = req.body ?? {};
      const enabled = body.enabled !== false;
      const latestVersion =
        body.latest_version != null ? String(body.latest_version).trim() : "";
      const latestBuild =
        body.latest_build == null || body.latest_build === ""
          ? null
          : Number(body.latest_build);
      const minSupportedBuild =
        body.min_supported_build == null || body.min_supported_build === ""
          ? null
          : Number(body.min_supported_build);
      const message = body.message != null ? String(body.message).trim() : "";
      const updateUrl =
        body.update_url != null ? String(body.update_url).trim() : "";
      const iosUrl = body.ios_url != null ? String(body.ios_url).trim() : "";
      const androidUrl =
        body.android_url != null ? String(body.android_url).trim() : "";
      const iosLatestBuild =
        body.ios_latest_build == null || body.ios_latest_build === ""
          ? null
          : Number(body.ios_latest_build);
      const iosMinSupportedBuild =
        body.ios_min_supported_build == null || body.ios_min_supported_build === ""
          ? null
          : Number(body.ios_min_supported_build);

      if (latestBuild != null && (!Number.isFinite(latestBuild) || latestBuild < 0)) {
        return res.status(400).json({
          status: "error",
          message: "latest_build must be a valid non-negative number",
        });
      }
      if (
        minSupportedBuild != null &&
        (!Number.isFinite(minSupportedBuild) || minSupportedBuild < 0)
      ) {
        return res.status(400).json({
          status: "error",
          message: "min_supported_build must be a valid non-negative number",
        });
      }
      if (
        latestBuild != null &&
        minSupportedBuild != null &&
        minSupportedBuild > latestBuild
      ) {
        return res.status(400).json({
          status: "error",
          message: "min_supported_build cannot be greater than latest_build",
        });
      }

      const payload = {
        enabled,
        latest_version: latestVersion,
        latest_build: latestBuild,
        min_supported_build: minSupportedBuild,
        ios_latest_build: iosLatestBuild,
        ios_min_supported_build: iosMinSupportedBuild,
        message,
        update_url: updateUrl,
        ios_url: iosUrl,
        android_url: androidUrl,
        updated_at: new Date().toISOString(),
        updated_by: req.user?.email || req.user?.username || "admin",
      };

      await firestoreDb
        .collection(APP_CONFIG_COLLECTION)
        .doc(MOBILE_UPDATE_DOC)
        .set(payload, { merge: true });

      res.json({ status: "success", config: payload });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

/** Paginated Firebase Auth users + subscription flag; ?email= for exact lookup. */
router.get(
  "/app-users",
  requirePermission("user:read"),
  async (req, res) => {
    try {
      const maxResults = req.query.pageSize
        ? Number(req.query.pageSize)
        : 50;
      const pageToken = req.query.pageToken || null;
      const email = req.query.email || "";
      const rawSub = String(req.query.subscription || "all").toLowerCase();
      const subscription =
        rawSub === "subscribed" || rawSub === "unsubscribed"
          ? rawSub
          : "all";
      const data = await appUsersAdminService.listAppUsers({
        maxResults,
        pageToken,
        email: email || undefined,
        subscription,
      });
      res.json({ status: "success", ...data });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.post(
  "/app-users/subscribe",
  requirePermission("admin:manage_subscribers"),
  async (req, res) => {
    try {
      const rawUid = req.body?.uid;
      const rawEmail = req.body?.email;
      const identifier = String(req.body?.identifier || "").trim();
      const planId = Number(req.body?.planId);
      const expiresAt = req.body?.expiresAt ?? null;

      let uid = String(rawUid || "").trim();
      let email = String(rawEmail || "").trim().toLowerCase();

      if (!uid && !email && identifier) {
        if (identifier.includes("@")) {
          email = identifier.toLowerCase();
        } else {
          uid = identifier;
        }
      }

      let authUser = null;
      if (uid) {
        authUser = await appUsersAdminService.getAppUserByUid(uid);
      } else if (email) {
        authUser = await appUsersAdminService.getAppUserByEmail(email);
      }

      if (!authUser) {
        return res.status(404).json({
          status: "error",
          message: "User not found. Only existing app users can be subscribed.",
        });
      }

      uid = authUser.uid;
      email = String(authUser.email || email || "").trim().toLowerCase();
      if (!email) {
        return res.status(400).json({
          status: "error",
          message: "User does not have an email. Cannot create subscription record.",
        });
      }

      if (!Number.isFinite(planId) || planId <= 0) {
        return res.status(400).json({
          status: "error",
          message: "planId is required",
        });
      }

      const result = await adminSubscriptionService.adminGrantSubscription({
        uid,
        email,
        planId,
        expiresAt,
      });

      if (result?.outcome === "already_subscribed") {
        return res.json({
          status: "success",
          outcome: "already_subscribed",
          message: "User already has an active subscription.",
          uid,
        });
      }

      res.json({
        status: "success",
        outcome: "granted",
        uid,
      });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.post(
  "/app-users/:uid/unsubscribe",
  requirePermission("admin:manage_subscribers"),
  async (req, res) => {
    try {
      const { uid } = req.params;
      const result = await adminSubscriptionService.adminRevokeSubscription(uid);
      res.json({ status: "success", ...result });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.delete(
  "/app-users/:uid",
  requirePermission("admin:manage_subscribers"),
  async (req, res) => {
    try {
      const { uid } = req.params;
      await appUsersAdminService.deleteFirebaseUser(uid);
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

/** Audio play analytics (library totals, per track, per day). Super-admin / org analytics only. */
router.get(
  "/audio-play-stats",
  requirePermission("admin:analytics"),
  async (req, res) => {
    try {
      const raw = req.query.days;
      let days = raw === undefined || raw === "" ? 30 : Number(raw);
      if (Number.isNaN(days)) days = 30;
      const data = await audioPlayModel.getStats({ days });
      res.json({ status: "success", ...data });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/referrals",
  requirePermission("admin:analytics"),
  async (req, res) => {
    try {
      const q = req.query.q ? String(req.query.q) : "";
      const status = req.query.status ? String(req.query.status) : "all";
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const data = await referralService.listAdmin({ q, status, limit });
      res.json({ status: "success", ...data });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.post(
  "/referrals/:id/recompute",
  requirePermission("admin:analytics"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid id" });
      }
      // For now recompute endpoint is a no-op placeholder for support workflows.
      res.json({ status: "success", recomputed: true, id });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/devotional-settings",
  requirePermission("admin:analytics"),
  async (req, res) => {
    try {
      const settings = await devotionalService.getSettings();
      res.json({ status: "success", settings });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.put(
  "/devotional-settings",
  requirePermission("admin:analytics"),
  async (req, res) => {
    try {
      const minReadSeconds = Number(req.body?.min_read_seconds);
      const minScrollPercent = Number(req.body?.min_scroll_percent ?? 70);
      const serverTimezone = String(req.body?.server_timezone ?? "Africa/Lagos");
      await devotionalService.updateSettings({
        minReadSeconds,
        minScrollPercent,
        serverTimezone,
      });
      const settings = await devotionalService.getSettings();
      res.json({ status: "success", settings });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/devotional-leaderboard",
  requirePermission("admin:analytics"),
  async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const timeframeRaw = req.query.timeframe
        ? String(req.query.timeframe)
        : "this_year";
      const timeframe =
        timeframeRaw === "this_month"
          ? "this_month"
          : "this_year"; // all_time (legacy) falls through to calendar-year board
      const rows = await devotionalService.getAdminLeaderboard({ limit, timeframe });
      res.json({ status: "success", rows });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/roles",
  requirePermission("admin:manage_roles"),
  async (req, res) => {
    try {
      const data = await adminService.listRolesDetailed();
      res.json({ status: "success", ...data });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.post(
  "/roles",
  requirePermission("admin:manage_roles"),
  async (req, res) => {
    try {
      const { slug, name, permissionIds } = req.body;
      if (!slug || !name) {
        return res
          .status(400)
          .json({ status: "error", message: "slug and name are required" });
      }
      const id = await adminService.createRole({ slug, name, permissionIds });
      res.status(201).json({ status: "success", id });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.patch(
  "/roles/:id",
  requirePermission("admin:manage_roles"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      await adminService.updateRole(id, {
        name: req.body.name,
        slug: req.body.slug,
      });
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.delete(
  "/roles/:id",
  requirePermission("admin:manage_roles"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      await adminService.deleteRole(id);
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.put(
  "/roles/:id/permissions",
  requirePermission("admin:manage_roles"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { permissionIds } = req.body;
      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({
          status: "error",
          message: "permissionIds array required",
        });
      }
      await adminService.setRolePermissions(id, permissionIds);
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/permissions",
  requirePermission("admin:manage_roles"),
  async (req, res) => {
    try {
      const permissions = await roleModel.listPermissions();
      res.json({ status: "success", permissions });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/admin-users-count",
  requirePermission("admin:invite"),
  async (req, res) => {
    try {
      const count = await userModel.countAdminUsers();
      res.json({ status: "success", count });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);


router.get(
  "/admin-users",
  requirePermission("admin:invite"),
  async (req, res) => {
    try {
      const users = await userModel.listAdminUsers();
      res.json({ status: "success", users });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.patch(
  "/admin-users/:id/role",
  requirePermission("admin:manage_roles"),
  async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const roleId = Number(req.body?.role_id);
      if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid user id" });
      }
      if (!Number.isFinite(roleId) || roleId <= 0) {
        return res.status(400).json({ status: "error", message: "role_id required" });
      }
      const role = await roleModel.getRoleById(roleId);
      if (!role) {
        return res.status(404).json({ status: "error", message: "Role not found" });
      }
      await adminService.assertNotLastSuperAdmin(userId, roleId);
      const ok = await userModel.updateUserRole(userId, roleId, role.slug);
      if (!ok) {
        return res.status(404).json({ status: "error", message: "User not found" });
      }
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.delete(
  "/admin-users/:id",
  requirePermission("admin:manage_roles"),
  async (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid user id" });
      }
      if (req.user?.id === userId) {
        return res.status(400).json({ status: "error", message: "You cannot delete your own account" });
      }
      await adminService.assertCanDeleteAdmin(userId);
      const ok = await userModel.deleteUser(userId);
      if (!ok) {
        return res.status(404).json({ status: "error", message: "User not found" });
      }
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/invitations",
  requirePermission("admin:invite"),
  async (req, res) => {
    try {
      const invitations = await adminService.listInvitations();
      res.json({ status: "success", invitations });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.post(
  "/invitations",
  requirePermission("admin:invite"),
  async (req, res) => {
    try {
      const { email, role_id: roleId, role_slug: roleSlug } = req.body;
      if (!email) {
        return res.status(400).json({ status: "error", message: "email required" });
      }
      let rid = roleId ? Number(roleId) : null;
      if (!rid && roleSlug) {
        rid = await roleModel.getRoleIdBySlug(roleSlug);
      }
      if (!rid) {
        return res
          .status(400)
          .json({ status: "error", message: "role_id or role_slug required" });
      }
      const { token, expiresAt } = await adminService.createInvitation({
        email,
        roleId: rid,
        createdByUserId: req.user.id,
      });
      const role = await roleModel.getRoleById(rid);
      const emailResult = await sendAdminInviteEmail({
        toEmail: email.trim().toLowerCase(),
        inviteToken: token,
        roleName: role?.name,
      });
      res.status(201).json({
        status: "success",
        expiresAt,
        emailSent: emailResult?.sent === true,
        message:
          emailResult?.sent === true
            ? "Invitation email sent."
            : "Invitation created. Configure SMTP to send email; otherwise copy the link from server logs.",
      });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.delete(
  "/invitations/:id",
  requirePermission("admin:invite"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      await adminService.revokeInvitation(id);
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.post(
  "/notifications/broadcast",
  requirePermission("notifications:send"),
  async (req, res) => {
    try {
      const { title, body, audience, state, states, uids } = req.body ?? {};
      const result = await sendBroadcast({ title, body, audience, state, states, uids });
      res.json({ status: "success", ...result });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const payload = req.body ?? {};
      console.error("POST /admin/notifications/broadcast failed:", {
        message: err.message,
        code: err.code,
        stack: err.stack,
        audience: payload.audience ?? null,
        titlePresent: Boolean(payload.title),
        notificationBodyPresent: Boolean(payload.body),
        statesCount: Array.isArray(payload.states) ? payload.states.length : 0,
        uidsCount: Array.isArray(payload.uids) ? payload.uids.length : 0,
        hasLegacyState: Boolean(payload.state),
      });
      res.status(500).json({ status: "error", message: err.message });
    }
  }
);

router.get(
  "/yt-stream",
  requirePermission("notifications:send"),
  async (req, res) => {
    try {
      const channels = await ytStreamAdminService.listYtStreams();
      res.json({ status: "success", channels });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.put(
  "/yt-stream/:docId",
  requirePermission("notifications:send"),
  async (req, res) => {
    try {
      const { docId } = req.params;
      const { link, name, section } = req.body ?? {};
      await ytStreamAdminService.updateYtStream(docId, { link, name, section });
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/broadcast-notifications",
  requirePermission("notifications:send"),
  async (req, res) => {
    try {
      const notifications = await broadcastNotificationsAdminService.listBroadcastNotifications();
      res.json({ status: "success", notifications });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.post(
  "/broadcast-notifications/remove",
  requirePermission("notifications:send"),
  async (req, res) => {
    try {
      const { title, body, timeStamp } = req.body ?? {};
      await broadcastNotificationsAdminService.removeBroadcastNotification({
        title,
        body,
        timeStamp,
      });
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

/** MySQL subscription_plans — amounts, codes, active flag (super_admin via admin:manage_plans). */
router.get(
  "/subscriber-plans",
  requirePermission("admin:manage_subscribers"),
  async (req, res) => {
    try {
      const plans = await SubscriptionPlanModel.getAllPlans();
      res.json({ status: "success", plans });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

/** MySQL subscription_plans — amounts, codes, active flag (super_admin via admin:manage_plans). */
router.get(
  "/subscription-plans",
  requirePermission("admin:manage_plans"),
  async (req, res) => {
    try {
      const plans = await SubscriptionPlanModel.listAllPlansAdmin();
      res.json({ status: "success", plans });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

/** Batch: Firestore students_code configured flags for plan_code list (comma-separated). */
router.get(
  "/student-verification-status",
  requirePermission("admin:manage_plans"),
  async (req, res) => {
    try {
      const raw = req.query.planCodes;
      if (!raw || String(raw).trim() === "") {
        return res.json({ status: "success", configured: {} });
      }
      const codes = String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const configured = await studentCodeAdminService.batchConfigured(codes);
      res.json({ status: "success", configured });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/subscription-plans/:id/student-verification",
  requirePermission("admin:manage_plans"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid id" });
      }
      const plan = await SubscriptionPlanModel.getPlanByIdAdmin(id);
      if (!plan) {
        return res.status(404).json({ status: "error", message: "Plan not found" });
      }
      if (!studentCodeAdminService.isStudentVerificationKind(plan.plan_kind)) {
        return res.status(400).json({
          status: "error",
          message: "Plan kind does not use student verification",
        });
      }
      if (!plan.plan_code || String(plan.plan_code).trim() === "") {
        return res.status(400).json({
          status: "error",
          message: "Plan must have a plan_code to store verification",
        });
      }
      const configured = await studentCodeAdminService.isConfigured(plan.plan_code);
      const code = configured
        ? await studentCodeAdminService.getCode(plan.plan_code)
        : null;
      res.json({ status: "success", configured, code });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.put(
  "/subscription-plans/:id/student-verification",
  requirePermission("admin:manage_plans"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid id" });
      }
      const plan = await SubscriptionPlanModel.getPlanByIdAdmin(id);
      if (!plan) {
        return res.status(404).json({ status: "error", message: "Plan not found" });
      }
      if (!studentCodeAdminService.isStudentVerificationKind(plan.plan_kind)) {
        return res.status(400).json({
          status: "error",
          message: "Plan kind does not use student verification",
        });
      }
      if (!plan.plan_code || String(plan.plan_code).trim() === "") {
        return res.status(400).json({
          status: "error",
          message: "Plan must have a plan_code to store verification",
        });
      }
      const { code } = req.body ?? {};
      await studentCodeAdminService.upsertCode(plan.plan_code, code);
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.delete(
  "/subscription-plans/:id/student-verification",
  requirePermission("admin:manage_plans"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid id" });
      }
      const plan = await SubscriptionPlanModel.getPlanByIdAdmin(id);
      if (!plan) {
        return res.status(404).json({ status: "error", message: "Plan not found" });
      }
      if (!studentCodeAdminService.isStudentVerificationKind(plan.plan_kind)) {
        return res.status(400).json({
          status: "error",
          message: "Plan kind does not use student verification",
        });
      }
      if (!plan.plan_code || String(plan.plan_code).trim() === "") {
        return res.status(400).json({
          status: "error",
          message: "Plan must have a plan_code",
        });
      }
      await studentCodeAdminService.deleteCode(plan.plan_code);
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  }
);

router.post(
  "/subscription-plans",
  requirePermission("admin:manage_plans"),
  async (req, res) => {
    try {
      const {
        name,
        description,
        amount,
        interval,
        currency,
        plan_code,
        plan_kind,
        is_active,
      } = req.body;
      if (!name || amount == null || amount === "") {
        return res.status(400).json({
          status: "error",
          message: "name and amount are required",
        });
      }
      const id = await SubscriptionPlanModel.createPlanAdmin({
        name,
        description,
        amount,
        interval,
        currency,
        plan_code,
        plan_kind,
        is_active,
      });
      const row = await SubscriptionPlanModel.getPlanByIdAdmin(id);
      res.status(201).json({ status: "success", id, plan: row });
    } catch (error) {
      const msg = error.message || String(error);
      if (msg.includes("Duplicate") || msg.includes("duplicate")) {
        return res.status(409).json({ status: "error", message: msg });
      }
      res.status(400).json({ status: "error", message: msg });
    }
  }
);

router.put(
  "/subscription-plans/:id",
  requirePermission("admin:manage_plans"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid id" });
      }
      const existing = await SubscriptionPlanModel.getPlanByIdAdmin(id);
      if (!existing) {
        return res.status(404).json({ status: "error", message: "Plan not found" });
      }
      const {
        name,
        description,
        amount,
        interval,
        currency,
        plan_kind,
        is_active,
      } = req.body;
      // plan_code is immutable after create (Firestore students_code + app catalog).
      const plan = await SubscriptionPlanModel.updatePlanAdmin(id, {
        name,
        description,
        amount,
        interval,
        currency,
        plan_kind,
        is_active,
      });
      res.json({ status: "success", plan });
    } catch (error) {
      const msg = error.message || String(error);
      if (msg.includes("Duplicate") || msg.includes("duplicate")) {
        return res.status(409).json({ status: "error", message: msg });
      }
      res.status(400).json({ status: "error", message: msg });
    }
  }
);

/** In-app ads — list (all org). */
router.get("/ads", requirePermission("ads:read"), async (req, res) => {
  try {
    const ads = await adModel.listAllForAdmin();
    res.json({ status: "success", ads });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

/** Multipart image upload to S3 (ads/ folder). Must be registered before /ads/:id routes. */
router.post(
  "/ads/upload",
  requirePermission("ads:write"),
  upload.single("adfile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: "error", message: "adfile required" });
      }
      const filename = req.file.originalname || "ad.jpg";
      const link = await adService.uploadImage(
        filename,
        req.file.buffer,
        req.file.mimetype
      );
      res.json({ status: "success", link });
    } catch (error) {
      console.error("ads upload:", error);
      res.status(500).json({ status: "error", message: error.message || "Upload failed" });
    }
  }
);

router.post("/ads", requirePermission("ads:write"), async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.asset_url || String(body.asset_url).trim() === "") {
      return res.status(400).json({ status: "error", message: "asset_url required" });
    }
    const { insertId, publicId } = await adModel.create({
      brand_name: body.brand_name,
      contact: body.contact,
      state: body.state,
      asset_url: String(body.asset_url).trim(),
      link_url: body.link_url != null ? String(body.link_url).trim() : null,
      ad_type: body.ad_type || "image_banner",
      slot: body.slot,
      sort_order: body.sort_order,
      is_active: body.is_active !== false,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
    });
    const row = await adModel.getById(insertId);
    res.status(201).json({ status: "success", id: insertId, public_id: publicId, ad: row });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.get(
  "/ads/:id/stats",
  requirePermission("ads:read"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid id" });
      }
      const existing = await adModel.getById(id);
      if (!existing) {
        return res.status(404).json({ status: "error", message: "Ad not found" });
      }
      const raw = req.query.days;
      let days = raw === undefined || raw === "" ? 30 : Number(raw);
      if (Number.isNaN(days)) days = 30;
      const stats = await adModel.getStatsByAdId(id, { days: days === 0 ? 0 : days });
      res.json({ status: "success", stats });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.patch("/ads/:id", requirePermission("ads:write"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid id" });
    }
    const existing = await adModel.getById(id);
    if (!existing) {
      return res.status(404).json({ status: "error", message: "Ad not found" });
    }
    const body = req.body ?? {};
    const ok = await adModel.update(id, body);
    if (!ok) {
      return res.json({ status: "success", message: "No changes" });
    }
    const row = await adModel.getById(id);
    res.json({ status: "success", ad: row });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.delete("/ads/:id", requirePermission("ads:write"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid id" });
    }
    const deleted = await adModel.delete(id);
    if (!deleted) {
      return res.status(404).json({ status: "error", message: "Ad not found" });
    }
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

module.exports = router;

/*
TODO(streak-reminder-scheduler-hook):
- Wire cron/scheduler job entry for daily near-midnight streak reminders (example: 23:30 server TZ).
- Trigger reminder service job from scheduler context, not from request/response path.
- Ensure idempotency and observability (uid/date dedupe, logging, and failure metrics).
*/
