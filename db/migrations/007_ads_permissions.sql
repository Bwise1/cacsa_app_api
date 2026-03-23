-- Ads feature: register permissions + grant to super_admin.
-- After migrate: assign ads:* to other roles via Admin → Roles → Edit permissions.
-- API: protect routes with requirePermission('ads:read') / requirePermission('ads:write').
-- Admin UI: gate nav with has('ads:write') and match session permissions from login.

INSERT IGNORE INTO permissions (slug, description) VALUES
('ads:read', 'View ads and metrics in admin'),
('ads:write', 'Create, edit, and publish ads');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug IN ('ads:read', 'ads:write')
WHERE r.slug = 'super_admin';
