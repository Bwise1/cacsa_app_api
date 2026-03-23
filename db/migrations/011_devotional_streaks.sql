CREATE TABLE IF NOT EXISTS devotional_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    min_read_seconds INT NOT NULL DEFAULT 120,
    min_scroll_percent TINYINT UNSIGNED NOT NULL DEFAULT 70,
    server_timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Lagos',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CHECK (id = 1),
    CHECK (min_read_seconds >= 10),
    CHECK (min_scroll_percent >= 10 AND min_scroll_percent <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO devotional_settings (id, min_read_seconds, min_scroll_percent, server_timezone)
VALUES (1, 120, 70, 'Africa/Lagos')
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS devotional_user_stats (
    firebase_uid VARCHAR(128) NOT NULL PRIMARY KEY,
    current_streak_days INT NOT NULL DEFAULT 0,
    longest_streak_days INT NOT NULL DEFAULT 0,
    total_points INT NOT NULL DEFAULT 0,
    last_completed_date DATE NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS devotional_completion_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL,
    devotional_id CHAR(8) NOT NULL,
    devotional_date DATE NOT NULL,
    active_seconds INT NOT NULL,
    max_scroll_percent TINYINT UNSIGNED NOT NULL,
    points_awarded INT NOT NULL DEFAULT 10,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_devotional_completion_uid_date (firebase_uid, devotional_date),
    KEY idx_devotional_completion_uid_created (firebase_uid, created_at),
    KEY idx_devotional_completion_date (devotional_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
