-- Org-wide analytics / overview (super_admin only by default).

INSERT IGNORE INTO permissions (slug, description) VALUES
('admin:analytics', 'View org-wide analytics and overview dashboard');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug = 'admin:analytics'
WHERE r.slug = 'super_admin';
