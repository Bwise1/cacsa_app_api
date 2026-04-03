const { db } = require("../utils/firebase");

/**
 * @returns {Promise<Array<{ title: string, body: string, timeStamp: string }>>}
 */
async function listBroadcastNotifications() {
  const snap = await db.collection("broadCastNotifications").doc("notifications").get();
  const raw = snap.data()?.notifications;
  if (!Array.isArray(raw)) return [];
  return [...raw].reverse();
}

/**
 * Remove entries matching title, body, and timeStamp (read–modify–write for reliability).
 */
async function removeBroadcastNotification(entry) {
  if (!entry || typeof entry !== "object") {
    throw new Error("entry is required");
  }
  const { title, body, timeStamp } = entry;
  if (title == null || body == null || timeStamp == null) {
    throw new Error("title, body, and timeStamp are required");
  }
  const t = String(title);
  const b = String(body);
  const ts = String(timeStamp);

  const docRef = db.collection("broadCastNotifications").doc("notifications");
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    const arr = snap.data()?.notifications;
    if (!Array.isArray(arr)) return;
    const filtered = arr.filter(
      (x) =>
        !(
          x &&
          String(x.title) === t &&
          String(x.body) === b &&
          String(x.timeStamp) === ts
        )
    );
    if (filtered.length === arr.length) {
      throw new Error("Notification not found");
    }
    transaction.set(docRef, { notifications: filtered }, { merge: true });
  });
}

module.exports = {
  listBroadcastNotifications,
  removeBroadcastNotification,
};
