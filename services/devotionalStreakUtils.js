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

module.exports = {
  getYesterday,
  computeStatsAfterDailyCompletion,
};
