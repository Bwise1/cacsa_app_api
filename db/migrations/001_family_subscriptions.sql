-- Family subscriptions (MySQL). Apply after 000_subscriptions.sql.
--
-- Note: We intentionally do NOT add FOREIGN KEY (subscription_id) REFERENCES subscriptions(id).
-- MySQL error 1824 ("Failed to open the referenced table 'subscriptions'") often happens when the
-- existing `subscriptions` table is non-InnoDB, lacks a compatible PRIMARY KEY on `id`, or differs
-- from this schema. The API still links rows by subscription_id; enforce consistency in app code.

CREATE TABLE IF NOT EXISTS family_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_uid VARCHAR(128) NOT NULL,
    subscription_id INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    max_seats INT NOT NULL DEFAULT 5,
    plan_tier VARCHAR(32) NOT NULL COMMENT 'standard_family | student_family',
    plan_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_owner (owner_uid),
    KEY idx_sub (subscription_id),
    KEY idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS family_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    family_id INT NOT NULL,
    email_normalized VARCHAR(255) NOT NULL,
    uid VARCHAR(128) NULL,
    role VARCHAR(32) NOT NULL COMMENT 'owner | member',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    invite_token_hash VARCHAR(128) NULL,
    invite_expires_at DATETIME NULL,
    student_verified_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_family_email (family_id, email_normalized),
    KEY idx_token (invite_token_hash),
    KEY idx_uid (uid),
    CONSTRAINT fk_member_family FOREIGN KEY (family_id) REFERENCES family_groups (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: add plan_code / plan_kind to subscription_plans (ignore errors if already present)
-- ALTER TABLE subscription_plans ADD COLUMN plan_code VARCHAR(64) NULL UNIQUE;
-- ALTER TABLE subscription_plans ADD COLUMN plan_kind VARCHAR(32) NOT NULL DEFAULT 'individual';
