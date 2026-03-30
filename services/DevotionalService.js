const DevotionalModel = require("../models/DevotionalModel");
const { db } = require("../utils/firebase");
const {
  computeStatsAfterDailyCompletion,
} = require("./devotionalStreakUtils");
const {
  rankFromYearPoints,
  rankFromMonthlyPoints,
} = require("./devotionalRankUtils");

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
    // Streak/points here are last persisted values; current_streak_days is only revised on completion (not when a day is missed).
    const stats = await this.model.getStats(firebaseUid);
    const nowYmd = formatInTimeZone(new Date(), settings.server_timezone);
    const monthKey = nowYmd.slice(0, 7);
    const yyyy = Number(nowYmd.slice(0, 4));
    const monthlyPoints = await this.model.getMonthlyPoints(firebaseUid, monthKey);
    // Competitive points + rank: calendar year in server TZ (Jan 1 starts fresh).
    const totalPoints = await this.model.getYearPoints(firebaseUid, yyyy);
    const { rank, rankColorHex } = rankFromYearPoints(totalPoints);
    return {
      currentStreakDays: Number(stats?.current_streak_days || 0),
      longestStreakDays: Number(stats?.longest_streak_days || 0),
      totalPoints,
      monthPoints: monthlyPoints,
      rank,
      rankColorHex,
      minReadSeconds: Number(settings.min_read_seconds || 120),
      minScrollPercent: Number(settings.min_scroll_percent || 70),
      serverTimezone: settings.server_timezone || "Africa/Lagos",
    };
  }

  async getAdminLeaderboard({ limit = 20, timeframe = "this_year" }) {
    const tf = timeframe === "this_month" ? "this_month" : "this_year";
    const rows =
      tf === "this_month"
        ? await this._getAdminLeaderboardThisMonth({ limit })
        : await this._getAdminLeaderboardThisYear({ limit });
    const rankFn =
      tf === "this_month"
        ? rankFromMonthlyPoints
        : rankFromYearPoints;
    const users = await Promise.all(
      rows.map(async (row) => {
        const pts = Number(row.total_points || 0);
        const { rank, rankColorHex } = rankFn(pts);
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
            totalPoints: pts,
            lastCompletedDate: row.last_completed_date
              ? String(row.last_completed_date).slice(0, 10)
              : null,
            rank,
            rankColorHex,
          };
        } catch (_) {
          return {
            firebaseUid: row.firebase_uid,
            fullName: row.firebase_uid,
            firstName: "",
            lastName: "",
            currentStreakDays: Number(row.current_streak_days || 0),
            longestStreakDays: Number(row.longest_streak_days || 0),
            totalPoints: pts,
            lastCompletedDate: row.last_completed_date
              ? String(row.last_completed_date).slice(0, 10)
              : null,
            rank,
            rankColorHex,
          };
        }
      })
    );
    return users;
  }

  async _getAdminLeaderboardThisMonth({ limit }) {
    const settings = await this.model.getSettings();
    const nowYmd = formatInTimeZone(new Date(), settings.server_timezone);
    const yyyyMm = nowYmd.slice(0, 7);
    return this.model.getAdminLeaderboardThisMonth({ limit, yyyyMm });
  }

  async _getAdminLeaderboardThisYear({ limit }) {
    const settings = await this.model.getSettings();
    const nowYmd = formatInTimeZone(new Date(), settings.server_timezone);
    const yyyy = Number(nowYmd.slice(0, 4));
    return this.model.getAdminLeaderboardThisYear({ limit, yyyy });
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

    const yyyy = Number(serverToday.slice(0, 4));

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
    const prevStreak = Number(stats?.current_streak_days || 0);
    const prevLongest = Number(stats?.longest_streak_days || 0);
    const prevYearPoints = await this.model.getYearPoints(firebaseUid, yyyy);
    const prevTotal = Math.max(0, prevYearPoints - DAILY_POINTS);

    const { currentStreakDays, longestStreakDays, totalPoints } =
      computeStatsAfterDailyCompletion({
        serverToday,
        prevLastDate,
        prevStreak,
        prevLongest,
        prevTotal,
        dailyPoints: DAILY_POINTS,
      });

    await this.model.upsertStats({
      firebaseUid,
      currentStreakDays,
      longestStreakDays,
      totalPoints,
      lastCompletedDate: serverToday,
    });

    const { rank, rankColorHex } = rankFromYearPoints(totalPoints);

    return {
      recorded: true,
      alreadyCompleted: false,
      currentStreakDays,
      longestStreakDays,
      totalPoints,
      monthPoints: await this.model.getMonthlyPoints(firebaseUid, serverToday.slice(0, 7)),
      pointsAwarded: DAILY_POINTS,
      rank,
      rankColorHex,
    };
  }
}

module.exports = { DevotionalService };
