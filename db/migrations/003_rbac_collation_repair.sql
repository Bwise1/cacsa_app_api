-- Normalize collations for RBAC tables (fixes "Illegal mix of collations" when joining
-- to legacy `users` if 002 created string columns with utf8mb4_0900_ai_ci vs utf8mb4_general_ci).
-- Safe to apply after 002; ALTER ... CONVERT is idempotent for matching charset/collation.

ALTER TABLE roles CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE permissions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE admin_invitations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE role_permissions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Idempotent backfill (only rows still missing role_id)
UPDATE users u
JOIN roles r ON r.slug COLLATE utf8mb4_unicode_ci = u.role COLLATE utf8mb4_unicode_ci
SET u.role_id = r.id
WHERE u.role_id IS NULL AND u.role IS NOT NULL AND u.role <> '';
