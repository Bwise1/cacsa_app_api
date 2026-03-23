-- Super-admin UI: manage Paystack subscription plan rows (amounts, codes, active flag).

INSERT IGNORE INTO permissions (slug, description) VALUES
('admin:manage_plans', 'View and edit subscription plans (amounts, codes, activation)');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug = 'admin:manage_plans'
WHERE r.slug = 'super_admin';
