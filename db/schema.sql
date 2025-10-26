-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL COMMENT 'Amount in Naira (NGN)',
    `interval` VARCHAR(50) NOT NULL DEFAULT 'annually',
    currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_plan_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default plans
INSERT INTO subscription_plans (name, description, amount, `interval`, currency) VALUES
('Students Plan', 'Verification needed', 600.00, 'annually', 'NGN'),
('Nigeria Plan', NULL, 2000.00, 'annually', 'NGN')
ON DUPLICATE KEY UPDATE
    description = VALUES(description),
    amount = VALUES(amount),
    `interval` = VALUES(`interval`),
    currency = VALUES(currency);
