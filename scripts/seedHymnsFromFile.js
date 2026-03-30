#!/usr/bin/env node
/**
 * Uploads a local hymns_bundle.json into Firebase Storage (same paths as the admin UI).
 *
 * Use this to seed Storage from the Flutter repo copy, e.g.:
 *   cd cacsa_app_api
 *   node scripts/seedHymnsFromFile.js ../../Devotion/assets/hymns/hymns_bundle.json
 *
 * Requires: firebase.json (service account) in the API project root; Storage enabled in Console.
 */
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const hymnStorageService = require("../services/hymnStorageService");

const filePath = process.argv[2] || process.env.HYMNS_BUNDLE_SEED_PATH;
if (!filePath) {
  console.error(
    "Usage: node scripts/seedHymnsFromFile.js <path-to-hymns_bundle.json>\n" +
      "Example: node scripts/seedHymnsFromFile.js ../../Devotion/assets/hymns/hymns_bundle.json"
  );
  process.exit(1);
}

const resolved = path.resolve(process.cwd(), filePath);
if (!fs.existsSync(resolved)) {
  console.error("File not found:", resolved);
  process.exit(1);
}

const raw = fs.readFileSync(resolved, "utf8");
let bundle;
try {
  bundle = JSON.parse(raw);
} catch (e) {
  console.error("Invalid JSON:", e.message);
  process.exit(1);
}

const HYMN_SCHEMA_VERSION = 1;
if (bundle.schemaVersion !== HYMN_SCHEMA_VERSION) {
  console.error(
    `Expected schemaVersion ${HYMN_SCHEMA_VERSION}, got ${bundle.schemaVersion}`
  );
  process.exit(1);
}

hymnStorageService
  .saveBundle(bundle)
  .then((result) => {
    console.log("Uploaded bundle + manifest.");
    console.log("contentRevision:", result.contentRevision);
    console.log("manifest.manifestUrl (set HYMNS_MANIFEST_URL in Flutter to this + manifest path):");
    return hymnStorageService.getManifest();
  })
  .then(({ manifestUrl, manifest }) => {
    console.log("manifestUrl:", manifestUrl);
    if (manifest) {
      console.log("bundleUrl:", manifest.bundleUrl);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
