const db = require("./db");

async function seedPlans() {
  try {
    console.log("Starting to seed subscription plans...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        amount DECIMAL(10, 2) NOT NULL COMMENT 'Amount in Naira (NGN)',
        \`interval\` VARCHAR(50) NOT NULL DEFAULT 'annually',
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        is_active BOOLEAN DEFAULT TRUE,
        plan_code VARCHAR(64) NULL,
        plan_kind VARCHAR(32) NOT NULL DEFAULT 'individual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_plan_name (name),
        UNIQUE KEY unique_plan_code (plan_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    try {
      await db.query(
        "ALTER TABLE subscription_plans ADD COLUMN plan_code VARCHAR(64) NULL"
      );
    } catch (_) {
      /* exists */
    }
    try {
      await db.query(
        "ALTER TABLE subscription_plans ADD COLUMN plan_kind VARCHAR(32) NOT NULL DEFAULT 'individual'"
      );
    } catch (_) {
      /* exists */
    }
    try {
      await db.query(
        "ALTER TABLE subscription_plans ADD UNIQUE KEY unique_plan_code (plan_code)"
      );
    } catch (_) {
      /* exists */
    }

    const plans = [
      {
        name: "Students Plan",
        description: "Verification needed",
        amount: 600.0,
        interval: "annually",
        currency: "NGN",
        plan_code: "students",
        plan_kind: "individual_student",
      },
      {
        name: "Nigeria Plan",
        description: null,
        amount: 2000.0,
        interval: "annually",
        currency: "NGN",
        plan_code: "nigeria",
        plan_kind: "individual",
      },
      {
        name: "Regular Family",
        description: "Up to 5 people (1 owner + 4 invites)",
        amount: 6000.0,
        interval: "annually",
        currency: "NGN",
        plan_code: "family_regular",
        plan_kind: "family_regular",
      },
      {
        name: "Student Family",
        description: "Up to 5 students; verification required",
        amount: 4500.0,
        interval: "annually",
        currency: "NGN",
        plan_code: "family_student",
        plan_kind: "family_student",
      },
    ];

    for (const plan of plans) {
      await db.query(
        `INSERT INTO subscription_plans (name, description, amount, \`interval\`, currency, plan_code, plan_kind)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           description = VALUES(description),
           amount = VALUES(amount),
           \`interval\` = VALUES(\`interval\`),
           currency = VALUES(currency),
           plan_code = VALUES(plan_code),
           plan_kind = VALUES(plan_kind)`,
        [
          plan.name,
          plan.description,
          plan.amount,
          plan.interval,
          plan.currency,
          plan.plan_code,
          plan.plan_kind,
        ]
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
