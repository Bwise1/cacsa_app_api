const db = require("../db/db");

exports.getAllSubscriptions = async () => {
  try {
    const [subscriptions] = await db.query("SELECT * FROM subscriptions");
    return subscriptions;
  } catch (error) {
    throw new Error("Error fetching subscriptions");
  }
};

exports.addSubscription = async (
  uid,
  amount,
  email,
  paystackRef,
  expirationDate
) => {
  try {
    const result = await db.query(
      "INSERT INTO subscriptions (uid, amount, email, status, expiration_date, paystack_ref) VALUES (?, ?, ?, 'inactive', ?, ?)",
      [uid, amount, email, expirationDate, paystackRef]
    );

    return result.insertId;
  } catch (error) {
    console.error("Error", error);
    throw new Error("Error adding subscription");
  }
};

exports.updateSubscriptionStatus = async (paystackRef, newStatus) => {
  try {
    await db.query(
      "UPDATE subscriptions SET status = ? WHERE paystack_ref = ?",
      [newStatus, paystackRef]
    );

    const [rows] = await db.query(
      "SELECT * FROM subscriptions WHERE paystack_ref = ?",
      [paystackRef]
    );

    return rows[0];
  } catch (error) {
    throw new Error("Error updating subscription status");
  }
};

exports.updateExpiredSubscriptions = async () => {
  try {
    const result = await db.query(
      "UPDATE subscriptions SET status = 'expired' WHERE expiration_date < NOW()"
    );

    return result.affectedRows;
  } catch (error) {
    throw new Error("Error updating expired subscriptions");
  }
};

exports.getExpiredSubscriptions = async () => {
  try {
    const [rows] = await db.query(
      "SELECT uid FROM subscriptions WHERE expiration_date < NOW() AND status != 'expired'"
    );
    console.log("Rows", rows);
    return rows;
  } catch (error) {
    throw new Error("Error getting expired subscriptions");
  }
};
