const { FieldPath } = require("firebase-admin/firestore");
const { admin, db, subscriptionsCollection } = require("../utils/firebase/index");
const adminSubscriptionService = require("./adminSubscriptionService");
const SubscriptionModel = require("../models/SubscriptionModel");

const auth = admin.auth();

/** Firestore allows up to 10 document reads per getAll call. */
const GET_ALL_CHUNK = 10;

/** Cache full Auth user count — matches Firebase Console total; avoids re-paging on every request. */
const AUTH_COUNT_CACHE_TTL_MS = 5 * 60 * 1000;
let authCountCache = {
  at: 0,
  registeredUsers: 0,
  registeredUsersApproximate: false,
};

/**
 * Walks every `listUsers` page (1000/batch) so the total matches Firebase Console
 * (e.g. "1–50 of 2597"). Uncached — use countRegisteredUsersApprox.
 */
async function countAllAuthUsersUncached() {
  let total = 0;
  let pageToken;
  const maxPerPage = 1000;
  let pages = 0;
  const MAX_PAGES = 2000;

  do {
    const result = await auth.listUsers(maxPerPage, pageToken);
    total += result.users.length;
    pageToken = result.pageToken;
    pages += 1;
    if (pages > MAX_PAGES) {
      return {
        registeredUsers: total,
        registeredUsersApproximate: true,
      };
    }
  } while (pageToken);

  return {
    registeredUsers: total,
    registeredUsersApproximate: false,
  };
}

async function countRegisteredUsersApprox() {
  const now = Date.now();
  if (
    now - authCountCache.at < AUTH_COUNT_CACHE_TTL_MS &&
    authCountCache.at > 0
  ) {
    return {
      registeredUsers: authCountCache.registeredUsers,
      registeredUsersApproximate: authCountCache.registeredUsersApproximate,
    };
  }

  const r = await countAllAuthUsersUncached();
  authCountCache = {
    at: now,
    registeredUsers: r.registeredUsers,
    registeredUsersApproximate: r.registeredUsersApproximate,
  };
  return r;
}

/**
 * Exact email lookup (single Auth API call).
 */
async function getAppUserByEmail(email) {
  try {
    const u = await auth.getUserByEmail(String(email).trim());
    return {
      uid: u.uid,
      email: u.email || "",
      emailVerified: u.emailVerified,
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime,
    };
  } catch (e) {
    if (e.code === "auth/user-not-found") return null;
    throw e;
  }
}

/** Matches overview KPI when data uses lowercase "active"; also accepts legacy casing. */
function subscriptionDocIsActive(d) {
  if (!d || typeof d.status !== "string") return false;
  return d.status.trim().toLowerCase() === "active";
}

function pickSubscriptionInfoFields(data) {
  if (!data || typeof data !== "object") return undefined;
  const out = {};
  if (data.planKind != null) out.planKind = data.planKind;
  if (data.familyId != null) out.familyId = String(data.familyId);
  if (data.role != null) out.role = data.role;
  if (data.familyTier != null) out.familyTier = data.familyTier;
  return Object.keys(out).length ? out : undefined;
}

/** Merge MySQL family/plan rows (subscription_plans.plan_kind, plan_tier) for admin Plan column. */
async function attachMysqlPlanLabels(users) {
  if (!users.length) return users;
  let labels;
  try {
    labels = await SubscriptionModel.getPlanLabelsForUids(users.map((u) => u.uid));
  } catch (e) {
    console.error("attachMysqlPlanLabels:", e.message);
    return users;
  }
  return users.map((u) => {
    const m = labels.get(u.uid);
    if (!m) return u;
    return {
      ...u,
      subscriptionInfo: {
        ...(u.subscriptionInfo || {}),
        mysqlPlanKind: m.planKind,
        mysqlPlanName: m.planName,
        mysqlPlanTier: m.planTier,
      },
    };
  });
}

async function enrichUsersWithSubscription(users) {
  if (!users.length) return users;
  const uids = users.map((u) => u.uid);
  const allSnaps = [];
  for (let i = 0; i < uids.length; i += GET_ALL_CHUNK) {
    const chunkUids = uids.slice(i, i + GET_ALL_CHUNK);
    const refs = chunkUids.map((uid) => subscriptionsCollection.doc(uid));
    const snaps = await db.getAll(...refs);
    allSnaps.push(...snaps);
  }
  return users.map((u, i) => {
    const d = allSnaps[i].exists ? allSnaps[i].data() : null;
    const active = subscriptionDocIsActive(d);
    const info = pickSubscriptionInfoFields(d);
    return {
      ...u,
      isSubscribed: Boolean(active),
      ...(info ? { subscriptionInfo: info } : {}),
    };
  });
}

/** Firebase Auth getUsers allows up to 100 identifiers per request. */
const AUTH_GET_USERS_CHUNK = 100;

async function fetchAuthUsersByUids(uids) {
  const map = new Map();
  for (let i = 0; i < uids.length; i += AUTH_GET_USERS_CHUNK) {
    const chunk = uids.slice(i, i + AUTH_GET_USERS_CHUNK);
    const res = await auth.getUsers(chunk.map((uid) => ({ uid })));
    for (const u of res.users) map.set(u.uid, u);
  }
  return map;
}

/**
 * Subscribed list: paginate Firestore where status=="active" (exact; matches KPI count),
 * then hydrate emails from Firebase Auth. Orphan docs (no Auth user) still appear with
 * authUserMissing and email from the subscription doc when present.
 */
async function listSubscribedUsersFromFirestore(opts) {
  const maxResults = Math.min(Math.max(opts.maxResults ?? 50, 1), 1000);
  const raw = decodeListCursor(opts.pageToken);
  const lastUid =
    raw && typeof raw.lastUid === "string" && raw.lastUid.length > 0
      ? raw.lastUid
      : null;

  let q = subscriptionsCollection
    .where("status", "==", "active")
    .orderBy(FieldPath.documentId())
    .limit(maxResults);

  if (lastUid) {
    q = q.startAfter(lastUid);
  }

  const snap = await q.get();
  const docs = snap.docs;

  const uids = docs.map((d) => d.id);
  const authByUid = await fetchAuthUsersByUids(uids);

  const users = docs.map((docSnap) => {
    const uid = docSnap.id;
    const data = docSnap.data();
    const rec = authByUid.get(uid);
    const subscriptionInfo = pickSubscriptionInfoFields(data);

    if (rec) {
      return {
        uid: rec.uid,
        email: rec.email || "",
        emailVerified: rec.emailVerified,
        createdAt: rec.metadata.creationTime,
        lastSignInAt: rec.metadata.lastSignInTime,
        isSubscribed: true,
        ...(subscriptionInfo ? { subscriptionInfo } : {}),
      };
    }

    return {
      uid,
      email: (data && data.email) || "",
      emailVerified: false,
      createdAt: "",
      lastSignInAt: "",
      isSubscribed: true,
      authUserMissing: true,
      ...(subscriptionInfo ? { subscriptionInfo } : {}),
    };
  });

  const nextPageToken =
    docs.length === maxResults
      ? encodeListCursor({ lastUid: docs[docs.length - 1].id })
      : null;

  return { users, nextPageToken };
}

function matchesSubscriptionFilter(u, subscription) {
  if (subscription === "subscribed") return u.isSubscribed === true;
  if (subscription === "unsubscribed") return u.isSubscribed === false;
  return true;
}

function encodeListCursor(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeListCursor(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const pad = token.length % 4 === 0 ? "" : "=".repeat(4 - (token.length % 4));
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Walks Firebase Auth pages until we have `maxResults` rows matching `subscription`,
 * or Firebase is exhausted. Cursor carries overflow rows + next Firebase token.
 * Used for unsubscribed filter (and legacy subscribed path is replaced).
 */
async function listAppUsersFiltered(opts) {
  const maxResults = Math.min(Math.max(opts.maxResults ?? 50, 1), 1000);
  const subscription = opts.subscription;
  const raw = decodeListCursor(opts.pageToken);
  let overflow = Array.isArray(raw?.o) ? raw.o.slice() : [];
  let firebaseToken =
    raw && Object.prototype.hasOwnProperty.call(raw, "ft")
      ? raw.ft
      : undefined;

  const out = [];

  while (out.length < maxResults) {
    while (overflow.length > 0 && out.length < maxResults) {
      out.push(overflow.shift());
    }
    if (out.length >= maxResults) break;
    if (firebaseToken === null) break;

    const batchSize = 100;
    const result = await auth.listUsers(
      batchSize,
      firebaseToken === undefined ? undefined : firebaseToken
    );
    const users = result.users.map((u) => ({
      uid: u.uid,
      email: u.email || "",
      emailVerified: u.emailVerified,
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime,
    }));
    const enriched = await enrichUsersWithSubscription(users);
    for (const u of enriched) {
      if (matchesSubscriptionFilter(u, subscription)) overflow.push(u);
    }
    firebaseToken = result.pageToken || null;
  }

  const hasMore = overflow.length > 0 || firebaseToken !== null;
  const nextPageToken = hasMore
    ? encodeListCursor({ ft: firebaseToken, o: overflow })
    : null;

  return { users: out, nextPageToken };
}

/**
 * @param {{ maxResults?: number, pageToken?: string | null, email?: string, subscription?: 'all'|'subscribed'|'unsubscribed' }} opts
 */
async function listAppUsers(opts = {}) {
  const subscription = opts.subscription || "all";
  const email = opts.email?.trim();
  if (email) {
    const one = await getAppUserByEmail(email);
    if (!one) return { users: [], nextPageToken: null };
    let enriched = await enrichUsersWithSubscription([one]);
    if (
      subscription !== "all" &&
      !matchesSubscriptionFilter(enriched[0], subscription)
    ) {
      return { users: [], nextPageToken: null };
    }
    enriched = await attachMysqlPlanLabels(enriched);
    return { users: enriched, nextPageToken: null };
  }

  const maxResults = Math.min(Math.max(opts.maxResults ?? 50, 1), 1000);

  let result;
  if (subscription === "subscribed") {
    result = await listSubscribedUsersFromFirestore({
      maxResults,
      pageToken: opts.pageToken,
    });
  } else if (subscription === "unsubscribed") {
    result = await listAppUsersFiltered({
      maxResults,
      pageToken: opts.pageToken,
      subscription,
    });
  } else {
    const pageToken = opts.pageToken || undefined;
    const listResult = await auth.listUsers(maxResults, pageToken);
    const users = listResult.users.map((u) => ({
      uid: u.uid,
      email: u.email || "",
      emailVerified: u.emailVerified,
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime,
    }));
    const enriched = await enrichUsersWithSubscription(users);
    result = {
      users: enriched,
      nextPageToken: listResult.pageToken || null,
    };
  }

  if (result.users?.length) {
    result.users = await attachMysqlPlanLabels(result.users);
  }
  return result;
}

function invalidateAuthUserCountCache() {
  authCountCache = {
    at: 0,
    registeredUsers: 0,
    registeredUsersApproximate: false,
  };
}

async function deleteFirebaseUser(uid) {
  try {
    await adminSubscriptionService.adminRevokeSubscription(uid);
  } catch (e) {
    if (!String(e.message || "").includes("No subscription")) throw e;
  }
  await auth.deleteUser(uid);
  invalidateAuthUserCountCache();
  return { ok: true };
}

module.exports = {
  countRegisteredUsersApprox,
  invalidateAuthUserCountCache,
  listAppUsers,
  getAppUserByEmail,
  deleteFirebaseUser,
};
