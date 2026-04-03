#!/usr/bin/env node
/**
 * DESTRUCTIVE maintenance: expire every MySQL subscription that is not already `expired`,
 * deactivate all `active` family_groups, then re-sync Firestore `subscriptions/{uid}` from MySQL
 * (deletes docs when there is no active access — fixes drift after manual Firestore deletes).
 *
 * Usage (from cacsa_app_api, with production .env if targeting prod):
 *   node scripts/expireAllSubscriptions.js --yes
 *
 * Requires: DB_* in .env, Firebase Admin (firebase.json) for sync.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error(
      "Refusing to run without --yes (this expires ALL non-expired subscriptions and deactivates ALL active families)."
    );
    process.exit(1);
  }

  const db = require("../db/db");
  const FamilyModel = require("../models/FamilyModel");
  const {
    syncSubscriptionToFirestore,
  } = require("../services/subscriptionFirestoreSyncService");

  const uids = new Set();

  const [activeFams] = await db.query(
    "SELECT id, owner_uid FROM family_groups WHERE status = 'active'"
  );
  for (const fam of activeFams) {
    if (fam.owner_uid) uids.add(String(fam.owner_uid));
    const memberUids = await FamilyModel.getFamilyMemberUids(fam.id);
    for (const u of memberUids) uids.add(String(u));
  }

  const [subRows] = await db.query(
    "SELECT uid FROM subscriptions WHERE LOWER(TRIM(status)) <> 'expired'"
  );
  for (const r of subRows) {
    if (r.uid) uids.add(String(r.uid));
  }

  const [famUp] = await db.query(
    "UPDATE family_groups SET status = 'inactive' WHERE status = 'active'"
  );
  console.log(
    `Deactivated family_groups: ${famUp.affectedRows ?? famUp.changedRows ?? 0}`
  );

  const [subUp] = await db.query(
    `UPDATE subscriptions
     SET status = 'expired',
         expiration_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
     WHERE LOWER(TRIM(status)) <> 'expired'`
  );
  console.log(
    `Marked subscriptions expired: ${subUp.affectedRows ?? subUp.changedRows ?? 0}`
  );

  const [extraUids] = await db.query(
    `SELECT DISTINCT uid FROM subscriptions WHERE uid IS NOT NULL AND TRIM(uid) <> ''
     UNION
     SELECT DISTINCT owner_uid AS uid FROM family_groups
       WHERE owner_uid IS NOT NULL AND TRIM(owner_uid) <> ''
     UNION
     SELECT DISTINCT uid FROM family_members WHERE uid IS NOT NULL AND TRIM(uid) <> ''`
  );
  for (const r of extraUids) {
    if (r.uid) uids.add(String(r.uid));
  }

  console.log(`Syncing Firestore for ${uids.size} uid(s)…`);
  let ok = 0;
  let err = 0;
  for (const uid of uids) {
    try {
      await syncSubscriptionToFirestore(uid);
      ok += 1;
    } catch (e) {
      err += 1;
      console.error(`  ${uid}:`, e.message || e);
    }
  }
  console.log(`Done. Firestore sync calls: ${ok} ok, ${err} errors.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
