/**
 * One-off diagnostic: compare Firestore `subscriptions` docs (status active) to Firebase Auth.
 * Samples `status` field casing across the first N documents (by document ID).
 *
 * Usage (from repo root): node scripts/diagnoseSubscriptionOrphans.js
 */
require("dotenv").config();

const { admin, subscriptionsCollection } = require("../utils/firebase/index");
const { FieldPath } = require("firebase-admin/firestore");

const auth = admin.auth();

const STATUS_SAMPLE_LIMIT = 500;
const ACTIVE_PAGE = 100;

function tallyStatus(samples) {
  const counts = {};
  for (const s of samples) {
    const key =
      s === undefined || s === null
        ? "(missing)"
        : typeof s === "string"
          ? `"${s}"`
          : String(s);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function sampleStatusFieldValues() {
  const snap = await subscriptionsCollection
    .orderBy(FieldPath.documentId())
    .limit(STATUS_SAMPLE_LIMIT)
    .get();
  const statuses = snap.docs.map((d) => {
    const data = d.data() || {};
    return data.status;
  });
  return { tally: tallyStatus(statuses), sampled: statuses.length };
}

async function checkActiveOrphans() {
  let lastUid = null;
  let totalActive = 0;
  let orphans = 0;
  const orphanSample = [];

  for (;;) {
    let q = subscriptionsCollection
      .where("status", "==", "active")
      .orderBy(FieldPath.documentId())
      .limit(ACTIVE_PAGE);
    if (lastUid) q = q.startAfter(lastUid);
    const snap = await q.get();
    if (snap.empty) break;

    const uids = snap.docs.map((d) => d.id);
    totalActive += uids.length;

    for (let i = 0; i < uids.length; i += 100) {
      const chunk = uids.slice(i, i + 100);
      const res = await auth.getUsers(chunk.map((uid) => ({ uid })));
      const found = new Set(res.users.map((u) => u.uid));
      for (const uid of chunk) {
        if (!found.has(uid)) {
          orphans += 1;
          if (orphanSample.length < 20) orphanSample.push(uid);
        }
      }
    }

    lastUid = snap.docs[snap.docs.length - 1].id;
    if (uids.length < ACTIVE_PAGE) break;
  }

  return { totalActive, orphans, orphanSample };
}

async function main() {
  console.log("=== Subscription diagnostics ===\n");

  console.log(
    `Sampling up to ${STATUS_SAMPLE_LIMIT} docs (by document ID) for status field values…`
  );
  const { tally, sampled } = await sampleStatusFieldValues();
  console.log(`Sampled ${sampled} documents. status value counts:`);
  console.log(JSON.stringify(tally, null, 2));
  console.log("");

  console.log(
    "Scanning Firestore subscriptions where status == \"active\" (exact), checking Auth…"
  );
  try {
    const { totalActive, orphans, orphanSample } = await checkActiveOrphans();
    console.log(`Active docs (exact query): ${totalActive}`);
    console.log(`Orphans (active doc but no Auth user): ${orphans}`);
    if (orphanSample.length) {
      console.log("Example orphan UIDs (max 20):");
      orphanSample.forEach((u) => console.log(`  ${u}`));
    }
  } catch (e) {
    console.error(
      "Active scan failed (composite index may be required). Error:",
      e.message
    );
    console.error(
      "Create an index on collection subscriptions: status ASC, __name__ ASC"
    );
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
