/**
 * Devotional rank tiers (Labourer → King) aligned with Flutter profile _RankStyle colors.
 * Scales: calendar-year points (app + "this year" leaderboard) vs monthly (leaderboard "this month").
 */

const TIERS = [
  { label: "Labourer", colorHex: "#FF1B1B" },
  { label: "Steward", colorHex: "#71AFD3" },
  { label: "Shepherd", colorHex: "#1F664E" },
  { label: "Armor-Bearer", colorHex: "#7A1D66" },
  { label: "Priest", colorHex: "#8D49F2" },
  { label: "Ruler", colorHex: "#2E7AEF" },
  { label: "High Priest", colorHex: "#0EA44B" },
  { label: "King", colorHex: "#D4AE3F" },
];

/** Minimum calendar-year points to reach each tier (resets each Jan 1 in server TZ). */
const YEAR_MIN_POINTS = [0, 100, 300, 600, 1000, 2000, 4000, 8000];

/** Minimum monthly points for the same tier names (this month tab). */
const MONTHLY_MIN_POINTS = [0, 20, 50, 90, 130, 170, 220, 280];

function rankFromPoints(points, minPointsByTier) {
  const n = Number(points || 0);
  let idx = 0;
  for (let i = minPointsByTier.length - 1; i >= 0; i -= 1) {
    if (n >= minPointsByTier[i]) {
      idx = i;
      break;
    }
  }
  const t = TIERS[Math.min(idx, TIERS.length - 1)];
  return { rank: t.label, rankColorHex: t.colorHex };
}

function rankFromYearPoints(yearPoints) {
  return rankFromPoints(yearPoints, YEAR_MIN_POINTS);
}

/** @deprecated Use rankFromYearPoints — competitive points are calendar-year, not lifetime. */
function rankFromLifetimePoints(totalPoints) {
  return rankFromYearPoints(totalPoints);
}

function rankFromMonthlyPoints(monthPoints) {
  return rankFromPoints(monthPoints, MONTHLY_MIN_POINTS);
}

module.exports = {
  TIERS,
  YEAR_MIN_POINTS,
  /** @deprecated use YEAR_MIN_POINTS */
  LIFETIME_MIN_POINTS: YEAR_MIN_POINTS,
  rankFromYearPoints,
  rankFromLifetimePoints,
  rankFromMonthlyPoints,
  rankFromPoints,
};
