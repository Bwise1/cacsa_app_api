-- Append-only listener events (Firebase UID + session) for play_start and listen_segment analytics.

CREATE TABLE IF NOT EXISTS audio_listen_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    audio_id INT NOT NULL,
    firebase_uid VARCHAR(128) NOT NULL,
    session_id CHAR(36) NOT NULL,
    event_type ENUM('play_start', 'listen_segment') NOT NULL,
    listen_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    ended_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_ale_audio FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE,
    KEY idx_ale_firebase_ended (firebase_uid, ended_at),
    KEY idx_ale_audio_ended (audio_id, ended_at),
    KEY idx_ale_ended (ended_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
