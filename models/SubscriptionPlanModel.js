const db = require("../db/db");

exports.getAllPlans = async () => {
  try {
    const [plans] = await db.query(
      "SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY amount ASC"
    );
    return plans;
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    throw new Error("Error fetching subscription plans");
  }
};

exports.getPlanById = async (id) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM subscription_plans WHERE id = ? AND is_active = TRUE",
      [id]
    );
    return rows[0];
  } catch (error) {
    console.error("Error fetching plan by ID:", error);
    throw new Error("Error fetching plan by ID");
  }
};

exports.createPlan = async (name, description, amount, interval, currency) => {
  try {
    const result = await db.query(
      "INSERT INTO subscription_plans (name, description, amount, interval, currency) VALUES (?, ?, ?, ?, ?)",
      [name, description, amount, interval, currency]
    );
    return result.insertId;
  } catch (error) {
    console.error("Error creating subscription plan:", error);
    throw new Error("Error creating subscription plan");
  }
};

exports.updatePlan = async (id, name, description, amount, interval, currency) => {
  try {
    await db.query(
      "UPDATE subscription_plans SET name = ?, description = ?, amount = ?, interval = ?, currency = ? WHERE id = ?",
      [name, description, amount, interval, currency, id]
    );

    const [rows] = await db.query(
      "SELECT * FROM subscription_plans WHERE id = ?",
      [id]
    );
    return rows[0];
  } catch (error) {
    console.error("Error updating subscription plan:", error);
    throw new Error("Error updating subscription plan");
  }
};

exports.deactivatePlan = async (id) => {
  try {
    await db.query(
      "UPDATE subscription_plans SET is_active = FALSE WHERE id = ?",
      [id]
    );
    return true;
  } catch (error) {
    console.error("Error deactivating subscription plan:", error);
    throw new Error("Error deactivating subscription plan");
  }
};
