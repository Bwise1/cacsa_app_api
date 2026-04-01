const { admin, db } = require("../utils/firebase");

const FieldValue = admin.firestore.FieldValue;

async function collectDeviceTokens() {
  const snap = await db.collection("users").get();
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
 * @param {{ title: string, body: string }} payload
 */
async function sendBroadcast(payload) {
  const { title, body } = payload;
  if (!title || !body) {
    throw new Error("title and body are required");
  }

  const tokens = await collectDeviceTokens();
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

  return { sent, failed, totalTokens: tokens.length };
}

module.exports = { sendBroadcast, collectDeviceTokens };

/*
TODO(streak-reminder-near-midnight):
- Add a scheduled service method that runs once daily near midnight in server TZ.
- Eligibility: users with valid device token, reminders enabled, and no completion for serverToday.
- Deduplicate sends per uid/date (e.g., reminder_sent_for_date) to avoid duplicate pushes.
- Suggested message: "Complete today's devotional before midnight to keep your streak alive."
*/
