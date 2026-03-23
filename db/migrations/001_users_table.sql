-- Admin/auth users (required before 002_rbac_admin: FK from admin_invitations, ALTER users).
-- If `users` already exists (e.g. created manually, never via migrations), this does nothing:
-- MySQL skips CREATE TABLE when the name exists; your existing schema and data are unchanged.

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(64) NULL,
    UNIQUE KEY uk_users_username (username),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
