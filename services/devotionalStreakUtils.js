/**
 * Calendar day before `yyyyMmDd` (UTC-based), as YYYY-MM-DD.
 * Must match the previous behavior in DevotionalService (used with server "today" strings).
 */
function getYesterday(yyyyMmDd) {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Streak and points after a successful daily walk completion.
 * Inputs reflect devotional_stats *before* upserting today's completion.
 */
function computeStatsAfterDailyCompletion({
  serverToday,
  prevLastDate,
  prevStreak,
  prevLongest,
  prevTotal,
  dailyPoints,
}) {
  const yesterday = getYesterday(serverToday);
  const currentStreakDays =
    prevLastDate === yesterday ? prevStreak + 1 : 1;
  const longestStreakDays = Math.max(prevLongest, currentStreakDays);
  const totalPoints = prevTotal + dailyPoints;
  return { currentStreakDays, longestStreakDays, totalPoints };
}

/**
 * Effective "live" streak for read paths.
 * - If last completion is today or yesterday, streak is still live.
 * - If the user has missed a full day, current streak is effectively 0.
 */
function computeEffectiveCurrentStreak({
  serverToday,
  lastCompletedDate,
  storedCurrentStreakDays,
}) {
  const stored = Math.max(0, Number(storedCurrentStreakDays || 0));
  if (!lastCompletedDate || !serverToday || stored <= 0) return 0;
  const last = String(lastCompletedDate).slice(0, 10);
  if (last === String(serverToday).slice(0, 10)) return stored;
  const yesterday = getYesterday(serverToday);
  return last === yesterday ? stored : 0;
}

module.exports = {
  getYesterday,
  computeStatsAfterDailyCompletion,
  computeEffectiveCurrentStreak,
};
