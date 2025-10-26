const db = require("./db");

async function seedPlans() {
  try {
    console.log("Starting to seed subscription plans...");

    // Create the subscription_plans table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        amount DECIMAL(10, 2) NOT NULL COMMENT 'Amount in Naira (NGN)',
        \`interval\` VARCHAR(50) NOT NULL DEFAULT 'annually',
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_plan_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("Table created or already exists.");

    // Insert default plans
    const plans = [
      {
        name: "Students Plan",
        description: "Verification needed",
        amount: 600.0,
        interval: "annually",
        currency: "NGN",
      },
      {
        name: "Nigeria Plan",
        description: null,
        amount: 2000.0,
        interval: "annually",
        currency: "NGN",
      },
    ];

    for (const plan of plans) {
      await db.query(
        `INSERT INTO subscription_plans (name, description, amount, \`interval\`, currency)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           description = VALUES(description),
           amount = VALUES(amount),
           \`interval\` = VALUES(\`interval\`),
           currency = VALUES(currency)`,
        [plan.name, plan.description, plan.amount, plan.interval, plan.currency]
      );
      console.log(`Seeded plan: ${plan.name}`);
    }

    console.log("Subscription plans seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding subscription plans:", error);
    process.exit(1);
  }
}

seedPlans();
