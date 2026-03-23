/**
 * Optional GA4 active-user metrics for admin dashboard.
 * Requires GA4_PROPERTY_ID and credentials (see hasGoogleCredentials).
 */

const fs = require("fs");

const CACHE_TTL_MS = 120_000; // 2 minutes

let cache = {
  at: 0,
  data: null,
};

function isPropertyIdSet() {
  const id = process.env.GA4_PROPERTY_ID;
  return id != null && String(id).trim() !== "";
}

/** True if we should attempt the Data API (avoids NO_ADC_FOUND process crashes). */
function hasGoogleCredentials() {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (p) {
    try {
      return fs.existsSync(String(p));
    } catch {
      return false;
    }
  }
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON &&
    String(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON).trim() !== ""
  ) {
    return true;
  }
  if (process.env.K_SERVICE) {
    return true;
  }
  if (process.env.GA4_USE_ADC === "1" || process.env.GA4_USE_ADC === "true") {
    return true;
  }
  return false;
}

function isConfigured() {
  return isPropertyIdSet();
}

async function getClient() {
  const { BetaAnalyticsDataClient } = require("@google-analytics/data");
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (p && fs.existsSync(String(p))) {
    return new BetaAnalyticsDataClient({ keyFilename: String(p) });
  }
  return new BetaAnalyticsDataClient();
}

function propertyName() {
  const id = String(process.env.GA4_PROPERTY_ID).trim();
  return `properties/${id}`;
}

async function fetchActiveUserMetricsUncached() {
  const empty = {
    activeUsersMonth: null,
    activeUsersToday: null,
    activeUsersLast30Min: null,
    ga4Error: undefined,
  };

  try {
    if (!isPropertyIdSet()) {
      return empty;
    }

    if (!hasGoogleCredentials()) {
      return {
        ...empty,
        ga4Error:
          "GA4 credentials missing. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file path, " +
          "or GA4_USE_ADC=1 if using gcloud application-default credentials (local only). " +
          "On Cloud Run, credentials are usually automatic.",
      };
    }

    const client = await getClient();
    const prop = propertyName();

    const out = {
      activeUsersMonth: null,
      activeUsersToday: null,
      activeUsersLast30Min: null,
      ga4Error: undefined,
    };

    try {
      const [monthReport] = await client.runReport({
        property: prop,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      });
      const mv = monthReport.rows?.[0]?.metricValues?.[0]?.value;
      if (mv != null) out.activeUsersMonth = Number(mv);

      const [todayReport] = await client.runReport({
        property: prop,
        dateRanges: [{ startDate: "today", endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      });
      const tv = todayReport.rows?.[0]?.metricValues?.[0]?.value;
      if (tv != null) out.activeUsersToday = Number(tv);

      const [rt] = await client.runRealtimeReport({
        property: prop,
        metrics: [{ name: "activeUsers" }],
      });
      const rv = rt.rows?.[0]?.metricValues?.[0]?.value;
      if (rv != null) out.activeUsersLast30Min = Number(rv);
    } catch (e) {
      out.ga4Error = e instanceof Error ? e.message : String(e);
    }

    return out;
  } catch (e) {
    return {
      ...empty,
      ga4Error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function getActiveUserMetricsCached() {
  try {
    const now = Date.now();
    if (cache.data && now - cache.at < CACHE_TTL_MS) {
      return cache.data;
    }
    const data = await fetchActiveUserMetricsUncached();
    cache = { at: now, data };
    return data;
  } catch (e) {
    return {
      activeUsersMonth: null,
      activeUsersToday: null,
      activeUsersLast30Min: null,
      ga4Error: e instanceof Error ? e.message : String(e),
    };
  }
}

module.exports = {
  isGa4Configured: isConfigured,
  hasGoogleCredentials,
  getActiveUserMetricsCached,
  fetchActiveUserMetricsUncached,
};
