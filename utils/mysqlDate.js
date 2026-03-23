/**
 * Normalize client `date` values to a MySQL-friendly `YYYY-MM-DD` string.
 * Handles ISO strings, locale-formatted millisecond timestamps (e.g. "1,774,203,387,797"
 * from `Date.now().toLocaleString()`), raw ms/unix numbers.
 *
 * @param {unknown} input
 * @returns {string | null}
 */
function normalizeDateForMysql(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (raw === "") return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const compact = raw.replace(/,/g, "").replace(/\s/g, "");
  const n = Number(compact);
  if (Number.isFinite(n)) {
    if (n > 1e12) {
      const d = new Date(n);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    }
    if (n > 1e9 && n < 1e12) {
      const d = new Date(n * 1000);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    }
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return null;
}

module.exports = { normalizeDateForMysql };
