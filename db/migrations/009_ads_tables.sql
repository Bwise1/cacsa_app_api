-- In-app ads: creative + advertiser metadata, engagement events, cached counts.

CREATE TABLE IF NOT EXISTS ads (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL,
    brand_name VARCHAR(255) NULL,
    contact VARCHAR(255) NULL,
    state VARCHAR(128) NULL,
    asset_url TEXT NOT NULL,
    link_url TEXT NULL,
    ad_type ENUM('image_banner', 'video_banner') NOT NULL DEFAULT 'image_banner',
    slot VARCHAR(32) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    starts_at DATE NULL,
    ends_at DATE NULL,
    impression_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    click_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_ads_public_id (public_id),
    KEY idx_ads_active_sort (is_active, sort_order, id),
    KEY idx_ads_dates (starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ad_engagement_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ad_id BIGINT UNSIGNED NOT NULL,
    event_type ENUM('impression', 'click') NOT NULL,
    firebase_uid VARCHAR(128) NOT NULL,
    session_id CHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_aee_ad_created (ad_id, created_at),
    KEY idx_aee_session_type (ad_id, session_id, event_type),
    CONSTRAINT fk_aee_ad FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
