-- Grant app update config management to super_admin by default.

INSERT IGNORE INTO permissions (slug, description) VALUES
('admin:manage_app_update', 'Manage mobile app update prompt configuration');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug = 'admin:manage_app_update'
WHERE r.slug = 'super_admin';

