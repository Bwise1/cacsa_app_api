-- Core Paystack subscription rows (required before family_groups FK).

CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(128) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'inactive',
    expiration_date DATETIME NOT NULL,
    paystack_ref VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_paystack_ref (paystack_ref),
    KEY idx_uid (uid),
    KEY idx_status_exp (status, expiration_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
