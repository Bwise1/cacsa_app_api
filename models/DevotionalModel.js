const db = require("../db/db");

function envInt(name, fallback) {
  const raw = process.env[name];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

class DevotionalModel {
  async getSettings() {
    const envMinRead = Math.max(10, envInt("DEVOTIONAL_MIN_READ_SECONDS", 120));
    const envMinScroll = Math.min(
      100,
      Math.max(10, envInt("DEVOTIONAL_MIN_SCROLL_PERCENT", 70))
    );
    const envTz =
      String(process.env.DEVOTIONAL_SERVER_TIMEZONE || "").trim() ||
      "Africa/Lagos";
    const [rows] = await db.query(
      `SELECT min_read_seconds, min_scroll_percent, server_timezone
       FROM devotional_settings
       WHERE id = 1
       LIMIT 1`
    );
    return (
      rows[0] || {
        min_read_seconds: envMinRead,
        min_scroll_percent: envMinScroll,
        server_timezone: envTz,
      }
    );
  }

  async updateSettings({ minReadSeconds, minScrollPercent, serverTimezone }) {
    await db.query(
      `INSERT INTO devotional_settings (id, min_read_seconds, min_scroll_percent, server_timezone)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        min_read_seconds = VALUES(min_read_seconds),
        min_scroll_percent = VALUES(min_scroll_percent),
        server_timezone = VALUES(server_timezone)`,
      [minReadSeconds, minScrollPercent, serverTimezone]
    );
  }

  async getStats(firebaseUid) {
    const [rows] = await db.query(
      `SELECT firebase_uid, current_streak_days, longest_streak_days, total_points, last_completed_date
       FROM devotional_user_stats
       WHERE firebase_uid = ?
       LIMIT 1`,
      [firebaseUid]
    );
    return rows[0] || null;
  }

  async upsertStats({
    firebaseUid,
    currentStreakDays,
    longestStreakDays,
    totalPoints,
    lastCompletedDate,
  }) {
    await db.query(
      `INSERT INTO devotional_user_stats
        (firebase_uid, current_streak_days, longest_streak_days, total_points, last_completed_date)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        current_streak_days = VALUES(current_streak_days),
        longest_streak_days = VALUES(longest_streak_days),
        total_points = VALUES(total_points),
        last_completed_date = VALUES(last_completed_date)`,
      [
        firebaseUid,
        currentStreakDays,
        longestStreakDays,
        totalPoints,
        lastCompletedDate,
      ]
    );
  }

  async insertCompletion({
    firebaseUid,
    devotionalId,
    devotionalDate,
    activeSeconds,
    maxScrollPercent,
    pointsAwarded,
  }) {
    await db.query(
      `INSERT INTO devotional_completion_events
        (firebase_uid, devotional_id, devotional_date, active_seconds, max_scroll_percent, points_awarded)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        firebaseUid,
        devotionalId,
        devotionalDate,
        activeSeconds,
        maxScrollPercent,
        pointsAwarded,
      ]
    );
  }

  async getMonthlyPoints(firebaseUid, yyyyMm) {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(points_awarded), 0) AS monthly_points
       FROM devotional_completion_events
       WHERE firebase_uid = ? AND DATE_FORMAT(devotional_date, '%Y-%m') = ?`,
      [firebaseUid, yyyyMm]
    );
    return Number(rows[0]?.monthly_points || 0);
  }

  async getAdminLeaderboard({ limit = 20 }) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [rows] = await db.query(
      `SELECT firebase_uid, current_streak_days, longest_streak_days, total_points, last_completed_date
       FROM devotional_user_stats
       ORDER BY total_points DESC, current_streak_days DESC, longest_streak_days DESC, firebase_uid ASC
       LIMIT ?`,
      [safeLimit]
    );
    return rows;
  }
}

module.exports = DevotionalModel;
