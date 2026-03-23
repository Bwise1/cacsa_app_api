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

module.exports = requirePermission;
