const DevotionalModel = require("../models/DevotionalModel");
const { db } = require("../utils/firebase");

const DAILY_POINTS = 10;

function parseDevotionalIdToDate(devotionalId) {
  const raw = String(devotionalId || "").trim();
  if (!/^\d{8}$/.test(raw)) return null;
  const dd = Number(raw.slice(0, 2));
  const mm = Number(raw.slice(2, 4));
  const yyyy = Number(raw.slice(4, 8));
  if (yyyy < 2000 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    date.getUTCFullYear() !== yyyy ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd
  ) {
    return null;
  }
  return `${yyyy.toString().padStart(4, "0")}-${mm
    .toString()
    .padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;
}

function formatInTimeZone(now, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

function getYesterday(yyyyMmDd) {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

class DevotionalService {
  constructor() {
    this.model = new DevotionalModel();
  }

  async getSettings() {
    return this.model.getSettings();
  }

  async updateSettings({ minReadSeconds, minScrollPercent, serverTimezone }) {
    if (!Number.isFinite(minReadSeconds) || minReadSeconds < 10) {
      throw new Error("min_read_seconds must be >= 10");
    }
    if (
      !Number.isFinite(minScrollPercent) ||
      minScrollPercent < 10 ||
      minScrollPercent > 100
    ) {
      throw new Error("min_scroll_percent must be between 10 and 100");
    }
    await this.model.updateSettings({
      minReadSeconds: Math.round(minReadSeconds),
      minScrollPercent: Math.round(minScrollPercent),
      serverTimezone:
        String(serverTimezone || "").trim() || "Africa/Lagos",
    });
  }

  async getProgress(firebaseUid) {
    const settings = await this.model.getSettings();
    const stats = await this.model.getStats(firebaseUid);
    const nowYmd = formatInTimeZone(new Date(), settings.server_timezone);
    const monthKey = nowYmd.slice(0, 7);
    const monthlyPoints = await this.model.getMonthlyPoints(firebaseUid, monthKey);
    return {
      currentStreakDays: Number(stats?.current_streak_days || 0),
      longestStreakDays: Number(stats?.longest_streak_days || 0),
      totalPoints: Number(stats?.total_points || 0),
      monthPoints: monthlyPoints,
      rank: "Labourer",
      minReadSeconds: Number(settings.min_read_seconds || 120),
      minScrollPercent: Number(settings.min_scroll_percent || 70),
      serverTimezone: settings.server_timezone || "Africa/Lagos",
    };
  }

  async getAdminLeaderboard({ limit = 20 }) {
    const rows = await this.model.getAdminLeaderboard({ limit });
    const users = await Promise.all(
      rows.map(async (row) => {
        try {
          const snap = await db.collection("users").doc(row.firebase_uid).get();
          const data = snap.exists ? snap.data() : null;
          const firstName = (data?.firstName || "").toString().trim();
          const lastName = (data?.lastName || "").toString().trim();
          const fullName = `${firstName} ${lastName}`.trim();
          return {
            firebaseUid: row.firebase_uid,
            fullName: fullName || row.firebase_uid,
            firstName,
            lastName,
            currentStreakDays: Number(row.current_streak_days || 0),
            longestStreakDays: Number(row.longest_streak_days || 0),
            totalPoints: Number(row.total_points || 0),
            lastCompletedDate: row.last_completed_date
              ? String(row.last_completed_date).slice(0, 10)
              : null,
          };
        } catch (_) {
          return {
            firebaseUid: row.firebase_uid,
            fullName: row.firebase_uid,
            firstName: "",
            lastName: "",
            currentStreakDays: Number(row.current_streak_days || 0),
            longestStreakDays: Number(row.longest_streak_days || 0),
            totalPoints: Number(row.total_points || 0),
            lastCompletedDate: row.last_completed_date
              ? String(row.last_completed_date).slice(0, 10)
              : null,
          };
        }
      })
    );
    return users;
  }

  async completeDailyWalk({
    firebaseUid,
    devotionalId,
    activeSeconds,
    maxScrollPercent,
  }) {
    const settings = await this.model.getSettings();
    const minRead = Number(settings.min_read_seconds || 120);
    const minScroll = Number(settings.min_scroll_percent || 70);
    const timezone = settings.server_timezone || "Africa/Lagos";
    const devotionalDate = parseDevotionalIdToDate(devotionalId);
    if (!devotionalDate) {
      throw new Error("Invalid devotional_id");
    }
    const serverToday = formatInTimeZone(new Date(), timezone);
    if (devotionalDate !== serverToday) {
      throw new Error("Only today's devotional can count for streak");
    }
    const secs = Number(activeSeconds || 0);
    const scroll = Number(maxScrollPercent || 0);
    if (secs < minRead) {
      throw new Error(`Minimum read time is ${minRead} seconds`);
    }
    if (scroll < minScroll) {
      throw new Error(`Minimum scroll engagement is ${minScroll}%`);
    }

    try {
      await this.model.insertCompletion({
        firebaseUid,
        devotionalId: String(devotionalId),
        devotionalDate,
        activeSeconds: Math.round(secs),
        maxScrollPercent: Math.round(scroll),
        pointsAwarded: DAILY_POINTS,
      });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return { recorded: false, alreadyCompleted: true };
      }
      throw e;
    }

    const stats = await this.model.getStats(firebaseUid);
    const prevLastDate = stats?.last_completed_date
      ? String(stats.last_completed_date).slice(0, 10)
      : null;
    const yesterday = getYesterday(serverToday);
    const prevStreak = Number(stats?.current_streak_days || 0);
    const prevLongest = Number(stats?.longest_streak_days || 0);
    const prevTotal = Number(stats?.total_points || 0);

    const currentStreakDays =
      prevLastDate === yesterday ? prevStreak + 1 : 1;
    const longestStreakDays = Math.max(prevLongest, currentStreakDays);
    const totalPoints = prevTotal + DAILY_POINTS;

    await this.model.upsertStats({
      firebaseUid,
      currentStreakDays,
      longestStreakDays,
      totalPoints,
      lastCompletedDate: serverToday,
    });

    return {
      recorded: true,
      alreadyCompleted: false,
      currentStreakDays,
      longestStreakDays,
      totalPoints,
      monthPoints: await this.model.getMonthlyPoints(firebaseUid, serverToday.slice(0, 7)),
      pointsAwarded: DAILY_POINTS,
    };
  }
}

module.exports = { DevotionalService };
