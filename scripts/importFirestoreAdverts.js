/**
 * One-time migration: copy Firestore collection `adverts` into MySQL `ads`.
 *
 * Prerequisites: run `npm run migrate` so table `ads` exists (009_ads_tables.sql).
 *
 * Usage (from cacsa_app_api):
 *   node scripts/importFirestoreAdverts.js
 *
 * Environment: same DB_* as the API; `firebase.json` / Firebase admin as in utils/firebase.
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const { randomUUID } = require("crypto");

async function main() {
  const { db } = require("../utils/firebase");
  const snap = await db.collection("adverts").get();

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  });

  let n = 0;
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const url = String(d.url || "").trim();
    const link = String(d.link || "").trim();
    if (!url) {
      console.warn(`[skip] ${doc.id}: missing url`);
      continue;
    }
    const publicId = randomUUID();
    await conn.query(
      `INSERT INTO ads (public_id, brand_name, contact, state, asset_url, link_url, ad_type, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'image_banner', 0, 1)`,
      [publicId, null, null, null, url, link || null]
    );
    n += 1;
    console.log(`[ok] firestore ${doc.id} -> public_id ${publicId}`);
  }

  await conn.end();
  console.log(`Imported ${n} row(s). Remove Firestore reads from the app after verifying.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
