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

exports.getPlanByPlanCode = async (planCode) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM subscription_plans WHERE plan_code = ? AND is_active = TRUE",
      [planCode]
    );
    return rows[0];
  } catch (error) {
    console.error("Error fetching plan by plan_code:", error);
    throw new Error("Error fetching plan by plan_code");
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

/** Admin: all plans including inactive */
exports.listAllPlansAdmin = async () => {
  const [plans] = await db.query(
    "SELECT * FROM subscription_plans ORDER BY id ASC"
  );
  return plans;
};

exports.getPlanByIdAdmin = async (id) => {
  const [rows] = await db.query(
    "SELECT * FROM subscription_plans WHERE id = ?",
    [id]
  );
  return rows[0] ?? null;
};

exports.createPlanAdmin = async ({
  name,
  description,
  amount,
  interval,
  currency,
  plan_code,
  plan_kind,
  is_active,
}) => {
  const [result] = await db.query(
    `INSERT INTO subscription_plans (name, description, amount, \`interval\`, currency, plan_code, plan_kind, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      description ?? null,
      Number(amount),
      interval || "annually",
      currency || "NGN",
      plan_code ?? null,
      plan_kind || "individual",
      is_active !== false && is_active !== 0 && is_active !== "false" ? 1 : 0,
    ]
  );
  return result.insertId;
};

exports.updatePlanAdmin = async (id, payload) => {
  const allowed = [
    "name",
    "description",
    "amount",
    "interval",
    "currency",
    "plan_code",
    "plan_kind",
    "is_active",
  ];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (payload[key] === undefined) continue;
    if (key === "interval") {
      sets.push("`interval` = ?");
      vals.push(payload[key]);
    } else if (key === "amount") {
      sets.push("amount = ?");
      vals.push(Number(payload[key]));
    } else if (key === "is_active") {
      sets.push("is_active = ?");
      const v = payload[key];
      vals.push(
        v === true || v === 1 || v === "true" || v === "1" ? 1 : 0
      );
    } else {
      sets.push(`${key} = ?`);
      vals.push(payload[key]);
    }
  }
  if (!sets.length) {
    return exports.getPlanByIdAdmin(id);
  }
  vals.push(id);
  await db.query(
    `UPDATE subscription_plans SET ${sets.join(", ")} WHERE id = ?`,
    vals
  );
  return exports.getPlanByIdAdmin(id);
};
