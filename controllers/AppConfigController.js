const express = require("express");
const { db } = require("../utils/firebase/index");

const router = express.Router();

const APP_CONFIG_COLLECTION = "appConfig";
const MOBILE_UPDATE_DOC = "mobile_update";

/**
 * Public mobile update configuration for app launch checker.
 * Returns only fields safe for clients.
 */
router.get("/mobile-update", async (req, res) => {
  try {
    const snap = await db.collection(APP_CONFIG_COLLECTION).doc(MOBILE_UPDATE_DOC).get();
    if (!snap.exists) {
      return res.json({
        status: "success",
        config: { enabled: false },
      });
    }
    const d = snap.data() || {};
    return res.json({
      status: "success",
      config: {
        enabled: d.enabled !== false,
        latest_version: d.latest_version ?? null,
        latest_build: d.latest_build ?? null,
        min_supported_build: d.min_supported_build ?? null,
        message: d.message ?? null,
        update_url: d.update_url ?? null,
        ios_url: d.ios_url ?? null,
        android_url: d.android_url ?? null,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

module.exports = router;

