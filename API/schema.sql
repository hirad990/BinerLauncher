CREATE TABLE IF NOT EXISTS launcher_presence (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    installation_id VARCHAR(128) NOT NULL,
    launcher_version VARCHAR(32) NOT NULL DEFAULT 'unknown',
    platform VARCHAR(32) NOT NULL DEFAULT 'windows',
    last_seen DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_launcher_installation (installation_id),
    KEY idx_launcher_last_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
