const { admin, db } = require("../utils/firebase");

const FieldValue = admin.firestore.FieldValue;
const FieldPath = admin.firestore.FieldPath;

/** Max Firebase UIDs per broadcast (audience "uids") — avoids huge fan-out by mistake. */
const MAX_UIDS_PER_BROADCAST = 500;

/** Firestore `in` queries allow at most 30 values per query. */
const FIRESTORE_IN_LIMIT = 30;

function extractTokensFromSnapshot(snap) {
  const tokens = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (d && d.token && typeof d.token === "string" && d.token.length > 0) {
      if (!tokens.includes(d.token)) tokens.push(d.token);
    }
  });
  return tokens;
}

/**
 * Normalize `states` array and legacy single `state` string.
 * Values must match Firestore `users.state` (same strings as MySQL `states.state_name`).
 */
function normalizeStateNames(states, stateLegacy) {
  if (Array.isArray(states) && states.length > 0) {
    return [...new Set(states.map((s) => String(s || "").trim()).filter(Boolean))];
  }
  const one = String(stateLegacy || "").trim();
  return one ? [one] : [];
}

function normalizeUidList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const x of raw) {
    const u = String(x || "").trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/**
 * @param {{ audience?: string, state?: string, states?: string[], uids?: string[] }} [options]
 * audience: `all` (default), `subscribed`, `state`, `uids` (requires `uids`: Firestore `users` doc ids)
 */
async function collectDeviceTokens(options = {}) {
  const audience = String(options.audience || "all").toLowerCase();

  if (audience === "uids") {
    const uids = normalizeUidList(options.uids);
    if (!uids.length) {
      throw new Error('Provide at least one user id when audience is "uids"');
    }
    if (uids.length > MAX_UIDS_PER_BROADCAST) {
      throw new Error(`At most ${MAX_UIDS_PER_BROADCAST} user ids allowed per broadcast`);
    }
    const tokenSet = new Set();
    for (let i = 0; i < uids.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = uids.slice(i, i + FIRESTORE_IN_LIMIT);
      const snap = await db.collection("users").where(FieldPath.documentId(), "in", chunk).get();
      snap.forEach((doc) => {
        const d = doc.data();
        if (d && d.token && typeof d.token === "string" && d.token.length > 0) {
          tokenSet.add(d.token);
        }
      });
    }
    return Array.from(tokenSet);
  }

  if (audience === "subscribed") {
    const query = db.collection("users").where("subscribed", "==", true);
    const snap = await query.get();
    return extractTokensFromSnapshot(snap);
  }

  if (audience === "state") {
    const stateNames = normalizeStateNames(options.states, options.state);
    if (!stateNames.length) {
      throw new Error('Select at least one state when audience is "state"');
    }
    const tokenSet = new Set();
    for (let i = 0; i < stateNames.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = stateNames.slice(i, i + FIRESTORE_IN_LIMIT);
      const snap = await db.collection("users").where("state", "in", chunk).get();
      snap.forEach((doc) => {
        const d = doc.data();
        if (d && d.token && typeof d.token === "string" && d.token.length > 0) {
          tokenSet.add(d.token);
        }
      });
    }
    return Array.from(tokenSet);
  }

  if (audience !== "all") {
    throw new Error('audience must be "all", "subscribed", "state", or "uids"');
  }

  const snap = await db.collection("users").get();
  return extractTokensFromSnapshot(snap);
}

/**
 * @param {{ title: string, body: string, audience?: string, state?: string, states?: string[], uids?: string[] }} payload
 */
async function sendBroadcast(payload) {
  const { title, body, audience, state, states, uids } = payload;
  if (!title || !body) {
    throw new Error("title and body are required");
  }

  const tokens = await collectDeviceTokens({ audience, state, states, uids });
  if (!tokens.length) {
    return { sent: 0, failed: 0, totalTokens: 0, message: "No device tokens found" };
  }

  const messaging = admin.messaging();
  let sent = 0;
  let failed = 0;
  const chunkSize = 500;

  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        sound: "default",
        status: "done",
        screen: "screenA",
      },
    });
    sent += res.successCount;
    failed += res.failureCount;
  }

  await db
    .collection("broadCastNotifications")
    .doc("notifications")
    .set(
      {
        notifications: FieldValue.arrayUnion([
          {
            title,
            body,
            timeStamp: new Date().toISOString(),
          },
        ]),
      },
      { merge: true }
    );

  const normalizedStates = normalizeStateNames(states, state);
  const normalizedUids = normalizeUidList(Array.isArray(uids) ? uids : []);

  return {
    sent,
    failed,
    totalTokens: tokens.length,
    audience: String(audience || "all"),
    /** @deprecated single-state; prefer `states` */
    state: state ? String(state) : undefined,
    states: normalizedStates.length ? normalizedStates : undefined,
    uidsRequested:
      String(audience || "").toLowerCase() === "uids" && normalizedUids.length
        ? normalizedUids.length
        : undefined,
  };
}

module.exports = { sendBroadcast, collectDeviceTokens };

/*
TODO(streak-reminder-near-midnight):
- Add a scheduled service method that runs once daily near midnight in server TZ.
- Eligibility: users with valid device token, reminders enabled, and no completion for serverToday.
- Deduplicate sends per uid/date (e.g., reminder_sent_for_date) to avoid duplicate pushes.
- Suggested message: "Complete today's devotional before midnight to keep your streak alive."
*/
