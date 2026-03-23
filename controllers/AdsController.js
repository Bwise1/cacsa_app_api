const express = require("express");
const { firebaseAuthMiddleware } = require("../middlewares/firebaseAuthMiddleware");
const { AdService, adModel } = require("../services/AdService");

const router = express.Router();
const adService = new AdService();

/** Public: active ads for mobile app. ?state= optional regional filter. */
router.get("/", async (req, res) => {
  try {
    const state = req.query.state != null ? String(req.query.state).trim() : "";
    const ads = await adModel.listActiveForApp(state ? { state } : {});
    res.json({ status: "success", ads });
  } catch (error) {
    console.error("GET /ads:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/:publicId/impression", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { publicId } = req.params;
    const sessionId = req.body?.session_id;
    const firebaseUid = req.firebaseUser.uid;
    await adService.recordImpression(publicId, firebaseUid, sessionId);
    return res.status(204).send();
  } catch (error) {
    if (error.code === "BAD_REQUEST") {
      return res.status(400).json({ status: "error", message: error.message });
    }
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ status: "error", message: error.message });
    }
    console.error("impression:", error);
    return res.status(500).json({ status: "error", message: "Could not record" });
  }
});

router.post("/:publicId/click", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { publicId } = req.params;
    const sessionId = req.body?.session_id;
    const firebaseUid = req.firebaseUser.uid;
    const result = await adService.recordClick(publicId, firebaseUid, sessionId);
    return res.status(200).json({
      status: "success",
      link: result.link,
      recorded: result.recorded,
      deduped: result.deduped,
    });
  } catch (error) {
    if (error.code === "BAD_REQUEST") {
      return res.status(400).json({ status: "error", message: error.message });
    }
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ status: "error", message: error.message });
    }
    if (error.code === "NO_LINK") {
      return res.status(400).json({ status: "error", message: error.message });
    }
    console.error("click:", error);
    return res.status(500).json({ status: "error", message: "Could not record" });
  }
});

module.exports = router;
