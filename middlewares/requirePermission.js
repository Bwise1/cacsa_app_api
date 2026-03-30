/**
 * @param {...string} requiredPermissionSlugs All listed permissions must be present on the JWT.
 */
function requirePermission(...requiredPermissionSlugs) {
  return (req, res, next) => {
    const perms = req.user?.permissions;
    if (!Array.isArray(perms)) {
      return res.status(403).json({
        status: "failed",
        message: "Forbidden: missing permissions on token.",
      });
    }
    const ok = requiredPermissionSlugs.every((p) => perms.includes(p));
    if (!ok) {
      return res.status(403).json({
        status: "failed",
        message: "Forbidden: insufficient permissions.",
      });
    }
    next();
  };
}

/** At least one of the listed permissions must be present (OR). */
function requireAnyPermission(...requiredPermissionSlugs) {
  return (req, res, next) => {
    const perms = req.user?.permissions;
    if (!Array.isArray(perms)) {
      return res.status(403).json({
        error: "Forbidden",
        hint: "Missing permissions on token.",
      });
    }
    const ok = requiredPermissionSlugs.some((p) => perms.includes(p));
    if (!ok) {
      return res.status(403).json({
        error: "Forbidden",
        hint:
          "Your account needs hymns:write or admin:analytics. Ask an admin to update permissions.",
      });
    }
    next();
  };
}

module.exports = requirePermission;
module.exports.requireAnyPermission = requireAnyPermission;
