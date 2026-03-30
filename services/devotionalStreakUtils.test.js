const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getYesterday,
  computeStatsAfterDailyCompletion,
} = require("./devotionalStreakUtils");

const DAILY = 10;

test("getYesterday returns previous calendar day in UTC", () => {
  assert.equal(getYesterday("2026-03-15"), "2026-03-14");
});

test("consecutive day: streak increments, longest unchanged if higher", () => {
  const r = computeStatsAfterDailyCompletion({
    serverToday: "2026-03-15",
    prevLastDate: "2026-03-14",
    prevStreak: 4,
    prevLongest: 10,
    prevTotal: 100,
    dailyPoints: DAILY,
  });
  assert.equal(r.currentStreakDays, 5);
  assert.equal(r.longestStreakDays, 10);
  assert.equal(r.totalPoints, 110);
});

test("consecutive day: longest updates when current exceeds", () => {
  const r = computeStatsAfterDailyCompletion({
    serverToday: "2026-03-15",
    prevLastDate: "2026-03-14",
    prevStreak: 7,
    prevLongest: 7,
    prevTotal: 70,
    dailyPoints: DAILY,
  });
  assert.equal(r.currentStreakDays, 8);
  assert.equal(r.longestStreakDays, 8);
  assert.equal(r.totalPoints, 80);
});

test("gap in days: streak resets to 1, longest preserved", () => {
  const r = computeStatsAfterDailyCompletion({
    serverToday: "2026-03-15",
    prevLastDate: "2026-03-10",
    prevStreak: 5,
    prevLongest: 7,
    prevTotal: 50,
    dailyPoints: DAILY,
  });
  assert.equal(r.currentStreakDays, 1);
  assert.equal(r.longestStreakDays, 7);
  assert.equal(r.totalPoints, 60);
});

test("null prevLastDate: streak starts at 1", () => {
  const r = computeStatsAfterDailyCompletion({
    serverToday: "2026-03-15",
    prevLastDate: null,
    prevStreak: 0,
    prevLongest: 0,
    prevTotal: 0,
    dailyPoints: DAILY,
  });
  assert.equal(r.currentStreakDays, 1);
  assert.equal(r.longestStreakDays, 1);
  assert.equal(r.totalPoints, 10);
});

test("totalPoints adds dailyPoints whether streak continues or resets", () => {
  const prevTotal = 200;
  const daily = 10;
  const afterGap = computeStatsAfterDailyCompletion({
    serverToday: "2026-03-15",
    prevLastDate: "2026-03-01",
    prevStreak: 99,
    prevLongest: 99,
    prevTotal,
    dailyPoints: daily,
  });
  const consecutive = computeStatsAfterDailyCompletion({
    serverToday: "2026-03-15",
    prevLastDate: "2026-03-14",
    prevStreak: 3,
    prevLongest: 5,
    prevTotal,
    dailyPoints: daily,
  });
  assert.equal(afterGap.totalPoints, prevTotal + daily);
  assert.equal(consecutive.totalPoints, prevTotal + daily);
});
