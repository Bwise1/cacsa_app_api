-- Hymns bundle editor in cacsa-app-admin (Firebase Storage).

INSERT IGNORE INTO permissions (slug, description) VALUES
('hymns:write', 'Edit hymn JSON bundle and publish to Firebase Storage');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug = 'hymns:write'
WHERE r.slug = 'super_admin';
