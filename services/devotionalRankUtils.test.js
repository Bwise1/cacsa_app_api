const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  rankFromYearPoints,
  rankFromMonthlyPoints,
} = require("./devotionalRankUtils");

test("year: zero is Labourer", () => {
  const r = rankFromYearPoints(0);
  assert.equal(r.rank, "Labourer");
  assert.equal(r.rankColorHex, "#FF1B1B");
});

test("year: tier boundaries", () => {
  assert.equal(rankFromYearPoints(99).rank, "Labourer");
  assert.equal(rankFromYearPoints(100).rank, "Steward");
  assert.equal(rankFromYearPoints(7999).rank, "High Priest");
  assert.equal(rankFromYearPoints(8000).rank, "King");
});

test("monthly: uses monthly scale", () => {
  assert.equal(rankFromMonthlyPoints(0).rank, "Labourer");
  assert.equal(rankFromMonthlyPoints(19).rank, "Labourer");
  assert.equal(rankFromMonthlyPoints(20).rank, "Steward");
  assert.equal(rankFromMonthlyPoints(280).rank, "King");
});
