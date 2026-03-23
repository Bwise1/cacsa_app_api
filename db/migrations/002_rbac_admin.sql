-- RBAC: roles, permissions, admin invitations; users.role_id
-- Use explicit collation so JOINs with legacy `users` (often utf8mb4_general_ci) do not error.

CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_roles_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_permissions_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_by_user_id INT NULL,
    accepted_at DATETIME NULL,
    revoked_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_admin_inv_token (token_hash),
    KEY idx_admin_inv_email (email),
    CONSTRAINT fk_admin_inv_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_admin_inv_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Idempotent: partial runs may already have added role_id / fk_users_role
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN role_id INT NULL',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_role'
);
SET @sql := IF(@fk_exists = 0,
    'ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Seed permissions
INSERT IGNORE INTO permissions (slug, description) VALUES
('notifications:send', 'Send push notification broadcasts'),
('audio:write', 'Create and manage audio content'),
('branch:write', 'Create and manage branch locations'),
('user:read', 'View app users'),
('admin:manage_roles', 'Manage roles and permission assignments'),
('admin:invite', 'Invite and revoke admin users');

-- Seed roles
INSERT IGNORE INTO roles (slug, name) VALUES
('super_admin', 'Super administrator'),
('content_editor', 'Content editor'),
('location_editor', 'Location editor'),
('viewer', 'Read-only');

-- super_admin: all permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super_admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.slug IN ('audio:write', 'user:read')
WHERE r.slug = 'content_editor';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.slug = 'branch:write'
WHERE r.slug = 'location_editor';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.slug = 'user:read'
WHERE r.slug = 'viewer';

-- Primary admin account -> super_admin
UPDATE users u
JOIN roles r ON r.slug = 'super_admin'
SET u.role_id = r.id, u.role = 'super_admin'
WHERE u.username = 'admin';

-- Legacy role string "admin" -> super_admin
UPDATE users u
JOIN roles r ON r.slug = 'super_admin'
SET u.role_id = r.id, u.role = 'super_admin'
WHERE u.role_id IS NULL AND LOWER(TRIM(u.role)) = 'admin';

-- Backfill role_id from legacy role slug when possible
UPDATE users u
JOIN roles r ON r.slug COLLATE utf8mb4_unicode_ci = u.role COLLATE utf8mb4_unicode_ci
SET u.role_id = r.id
WHERE u.role_id IS NULL AND u.role IS NOT NULL AND u.role <> '';

-- Remaining users without role -> viewer
UPDATE users u
JOIN roles r ON r.slug = 'viewer'
SET u.role_id = r.id, u.role = COALESCE(NULLIF(TRIM(u.role), ''), 'viewer')
WHERE u.role_id IS NULL;
