const express = require("express");
const { firebaseAuthMiddleware } = require("../middlewares/firebaseAuthMiddleware");
const { DevotionalService } = require("../services/DevotionalService");

const router = express.Router();
const devotionalService = new DevotionalService();

router.use(firebaseAuthMiddleware);

router.get("/progress/me", async (req, res) => {
  try {
    const firebaseUid = req.firebaseUser.uid;
    const progress = await devotionalService.getProgress(firebaseUid);
    res.json({ status: "success", ...progress });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/daily-walk/complete", async (req, res) => {
  try {
    const firebaseUid = req.firebaseUser.uid;
    const body = req.body ?? {};
    const out = await devotionalService.completeDailyWalk({
      firebaseUid,
      devotionalId: body.devotional_id,
      activeSeconds: body.active_seconds,
      maxScrollPercent: body.max_scroll_percent,
    });
    res.json({ status: "success", ...out });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
});

module.exports = router;
