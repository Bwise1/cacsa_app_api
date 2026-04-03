const crypto = require("crypto");
const { admin } = require("../utils/firebase");

const BUNDLE_PATH = "hymns/hymns_bundle.json";
const BUNDLE_DRAFT_PATH = "hymns/hymns_bundle_draft.json";
const MANIFEST_PATH = "hymns/hymns_manifest.json";
const HYMN_SCHEMA_VERSION = 1;

function gcsPublicUrl(bucketName, objectPath) {
  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
}

function getBucket() {
  if (!admin.apps?.length) {
    const err = new Error(
      "Firebase Admin is not initialized on the API server (check firebase.json)."
    );
    err.code = "STORAGE_UNAVAILABLE";
    throw err;
  }
  try {
    return admin.storage().bucket();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(
      `Storage bucket failed (${msg}). Open Firebase Console → Build → Storage → Get started (enable Storage). ` +
        `Optional: set FIREBASE_STORAGE_BUCKET on the API if the bucket name is not the default project.appspot.com.`
    );
    err.code = "STORAGE_UNAVAILABLE";
    throw err;
  }
}

function emptyBundle() {
  return {
    schemaVersion: HYMN_SCHEMA_VERSION,
    contentRevision: 0,
    updatedAt: new Date().toISOString(),
    defaultLocale: "en",
    supportedLocales: ["en", "yo"],
    categories: [
      {
        id: "general",
        sortOrder: 0,
        labels: { en: "Hymns", yo: "Orin" },
      },
      {
        id: "oniruuru",
        sortOrder: 1,
        labels: { en: "Various", yo: "Oniruuru" },
      },
    ],
    books: [
      {
        id: "cacsa_main",
        defaultLocale: "en",
        title: { en: "CACSA Hymnal", yo: "Iwe Orin CACSA" },
      },
      {
        id: "cacsa_various",
        defaultLocale: "en",
        title: { en: "Various Hymns", yo: "Orin Oniruuru" },
      },
    ],
    hymns: [],
  };
}

async function downloadText(objectPath) {
  const bucket = getBucket();
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buf] = await file.download();
  return buf.toString("utf8");
}

async function uploadJson(objectPath, body, makePublic) {
  const bucket = getBucket();
  const file = bucket.file(objectPath);
  await file.save(Buffer.from(body, "utf8"), {
    metadata: {
      contentType: "application/json",
      cacheControl: "public, max-age=120",
    },
  });
  if (makePublic) {
    await file.makePublic();
  }
}

async function deleteFileIfExists(objectPath) {
  const bucket = getBucket();
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (exists) await file.delete();
}

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function manifestPublicUrl() {
  const bucket = getBucket();
  return gcsPublicUrl(bucket.name, MANIFEST_PATH);
}

function validateBundleShape(bundle) {
  if (!bundle || bundle.schemaVersion !== HYMN_SCHEMA_VERSION) {
    const e = new Error("Invalid bundle");
    e.code = "INVALID_BUNDLE";
    throw e;
  }
}

/**
 * @returns {Promise<{ bundle: object, exists: boolean, hasDraft: boolean }>}
 */
async function getBundle() {
  const draftRaw = await downloadText(BUNDLE_DRAFT_PATH);
  if (draftRaw) {
    return { bundle: JSON.parse(draftRaw), exists: true, hasDraft: true };
  }
  const liveRaw = await downloadText(BUNDLE_PATH);
  if (liveRaw) {
    return { bundle: JSON.parse(liveRaw), exists: true, hasDraft: false };
  }
  return { bundle: emptyBundle(), exists: false, hasDraft: false };
}

/**
 * @returns {Promise<{ manifest: object | null, manifestUrl: string }>}
 */
async function getManifest() {
  const url = await manifestPublicUrl();
  const raw = await downloadText(MANIFEST_PATH);
  if (!raw) {
    return { manifest: null, manifestUrl: url };
  }
  return { manifest: JSON.parse(raw), manifestUrl: url };
}

/**
 * Save edits to draft only — does not update the public manifest or mobile sync version.
 * @param {object} bundle
 * @returns {Promise<{ ok: boolean, draft: true }>}
 */
async function saveDraft(bundle) {
  validateBundleShape(bundle);
  bundle.updatedAt = new Date().toISOString();
  await uploadJson(BUNDLE_DRAFT_PATH, JSON.stringify(bundle), true);
  return { ok: true, draft: true };
}

/**
 * Publish live bundle + manifest. Increments syncVersion (and contentRevision) once per publish.
 * @param {object | undefined} bundleOptional — if set, use this bundle; else draft, else live (re-publish).
 * @returns {Promise<{ ok: boolean, manifest: object, syncVersion: number, contentRevision: number }>}
 */
async function publishBundle(bundleOptional) {
  let bundle;
  if (bundleOptional != null) {
    bundle = bundleOptional;
  } else {
    const draftRaw = await downloadText(BUNDLE_DRAFT_PATH);
    if (draftRaw) {
      bundle = JSON.parse(draftRaw);
    } else {
      const liveRaw = await downloadText(BUNDLE_PATH);
      if (!liveRaw) {
        const e = new Error("Nothing to publish");
        e.code = "NOTHING_TO_PUBLISH";
        throw e;
      }
      bundle = JSON.parse(liveRaw);
    }
  }

  validateBundleShape(bundle);

  const manifestOld = await getManifest();
  const prevSync =
    manifestOld.manifest?.syncVersion ??
    manifestOld.manifest?.contentRevision ??
    0;
  const nextSync = Math.max(1, prevSync + 1);

  bundle.updatedAt = new Date().toISOString();
  bundle.contentRevision = nextSync;

  const bundleJson = JSON.stringify(bundle);
  const hash = sha256Hex(bundleJson);

  await uploadJson(BUNDLE_PATH, bundleJson, true);
  await deleteFileIfExists(BUNDLE_DRAFT_PATH);

  const bucket = getBucket();
  const bundlePublicUrl = gcsPublicUrl(bucket.name, BUNDLE_PATH);

  const manifest = {
    schemaVersion: bundle.schemaVersion,
    contentRevision: bundle.contentRevision,
    syncVersion: nextSync,
    bundleUrl: bundlePublicUrl,
    bundleSha256: hash,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  await uploadJson(MANIFEST_PATH, manifestJson, true);

  return {
    ok: true,
    manifest,
    syncVersion: nextSync,
    contentRevision: bundle.contentRevision,
  };
}

module.exports = {
  BUNDLE_PATH,
  BUNDLE_DRAFT_PATH,
  MANIFEST_PATH,
  getBundle,
  getManifest,
  saveDraft,
  publishBundle,
  /** @deprecated Use publishBundle for uploads that should go live; saveDraft for in-progress edits. */
  saveBundle: publishBundle,
};
