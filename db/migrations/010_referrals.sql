CREATE TABLE IF NOT EXISTS referral_codes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL,
    code VARCHAR(32) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_referral_codes_code (code),
    UNIQUE KEY uk_referral_codes_uid (firebase_uid),
    KEY idx_referral_codes_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referral_attributions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    referred_uid VARCHAR(128) NOT NULL,
    referrer_uid VARCHAR(128) NOT NULL,
    referral_code VARCHAR(32) NOT NULL,
    status ENUM('pending', 'converted', 'rejected') NOT NULL DEFAULT 'pending',
    captured_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    converted_at DATETIME(3) NULL,
    rejected_reason VARCHAR(255) NULL,
    UNIQUE KEY uk_referral_attributions_referred_uid (referred_uid),
    KEY idx_referral_attributions_referrer_uid (referrer_uid),
    KEY idx_referral_attributions_status (status),
    KEY idx_referral_attributions_code (referral_code),
    CONSTRAINT fk_referral_attributions_code
      FOREIGN KEY (referral_code) REFERENCES referral_codes(code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referral_conversions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    attribution_id BIGINT UNSIGNED NOT NULL,
    subscription_id INT NOT NULL,
    reward_points INT NOT NULL DEFAULT 100,
    converted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_referral_conversions_attribution_id (attribution_id),
    UNIQUE KEY uk_referral_conversions_subscription_id (subscription_id),
    CONSTRAINT fk_referral_conversions_attr
      FOREIGN KEY (attribution_id) REFERENCES referral_attributions(id)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
