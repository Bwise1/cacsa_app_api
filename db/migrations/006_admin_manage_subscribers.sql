-- Grant app subscriber management (admin UI) to super_admin by default.

INSERT IGNORE INTO permissions (slug, description) VALUES
('admin:manage_subscribers', 'Grant/revoke app subscriptions and delete Firebase users from admin');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug = 'admin:manage_subscribers'
WHERE r.slug = 'super_admin';
