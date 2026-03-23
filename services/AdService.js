const db = require("../db/db");
const { uploadFile } = require("../utils/aws");
const AdModel = require("../models/AdModel");

const adModel = new AdModel();

function isUuidSessionId(s) {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}

function isPublicId(s) {
  return isUuidSessionId(s);
}

function isAdSchedulable(ad) {
  if (!ad || !ad.is_active) return false;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;
  if (ad.starts_at) {
    const s = String(ad.starts_at).slice(0, 10);
    if (s > todayStr) return false;
  }
  if (ad.ends_at) {
    const e = String(ad.ends_at).slice(0, 10);
    if (e < todayStr) return false;
  }
  return true;
}

function isHttpUrl(s) {
  if (!s || typeof s !== "string") return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

class AdService {
  constructor(bucketName) {
    this.bucketName = bucketName || process.env.S3_BUCKET_BUCKET_NAME;
  }

  async uploadImage(filename, file, contentType) {
    if (!this.bucketName) {
      throw new Error("S3 bucket not configured");
    }
    return uploadFile(filename, this.bucketName, "ads", file, contentType);
  }

  async recordImpression(publicId, firebaseUid, sessionId) {
    if (!isPublicId(publicId)) {
      const err = new Error("Invalid ad id");
      err.code = "BAD_REQUEST";
      throw err;
    }
    if (!isUuidSessionId(sessionId)) {
      const err = new Error("session_id must be a UUID string");
      err.code = "BAD_REQUEST";
      throw err;
    }
    const ad = await adModel.getByPublicId(publicId);
    if (!ad || !isAdSchedulable(ad)) {
      const err = new Error("Ad not found");
      err.code = "NOT_FOUND";
      throw err;
    }
    if (await adModel.hasImpressionToday(ad.id, firebaseUid, sessionId)) {
      return { recorded: false, deduped: true };
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO ad_engagement_events (ad_id, event_type, firebase_uid, session_id)
         VALUES (?, 'impression', ?, ?)`,
        [ad.id, firebaseUid, sessionId]
      );
      await conn.query(
        `UPDATE ads SET impression_count = impression_count + 1 WHERE id = ?`,
        [ad.id]
      );
      await conn.commit();
      return { recorded: true, deduped: false };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async recordClick(publicId, firebaseUid, sessionId) {
    if (!isPublicId(publicId)) {
      const err = new Error("Invalid ad id");
      err.code = "BAD_REQUEST";
      throw err;
    }
    if (!isUuidSessionId(sessionId)) {
      const err = new Error("session_id must be a UUID string");
      err.code = "BAD_REQUEST";
      throw err;
    }
    const ad = await adModel.getByPublicId(publicId);
    if (!ad || !isAdSchedulable(ad)) {
      const err = new Error("Ad not found");
      err.code = "NOT_FOUND";
      throw err;
    }
    const link = ad.link_url ? String(ad.link_url).trim() : "";
    if (!isHttpUrl(link)) {
      const err = new Error("Ad has no valid link URL");
      err.code = "NO_LINK";
      throw err;
    }
    if (await adModel.hasClickForSession(ad.id, sessionId)) {
      return { recorded: false, deduped: true, link };
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO ad_engagement_events (ad_id, event_type, firebase_uid, session_id)
         VALUES (?, 'click', ?, ?)`,
        [ad.id, firebaseUid, sessionId]
      );
      await conn.query(
        `UPDATE ads SET click_count = click_count + 1 WHERE id = ?`,
        [ad.id]
      );
      await conn.commit();
      return { recorded: true, deduped: false, link };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

module.exports = { AdService, adModel, isHttpUrl, isAdSchedulable, isUuidSessionId };
