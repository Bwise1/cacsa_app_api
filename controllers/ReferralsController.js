const express = require("express");
const { firebaseAuthMiddleware } = require("../middlewares/firebaseAuthMiddleware");
const { ReferralService } = require("../services/ReferralService");

const router = express.Router();
const referralService = new ReferralService();

router.get("/join", (req, res) => {
  const code = String(req.query.r || "").trim().toUpperCase();
  const deep = `cacsa://referral/join?r=${encodeURIComponent(code)}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width"/><title>Join CACSA referral</title></head>
<body style="font-family:system-ui;padding:24px;">
  <h2>CACSA referral</h2>
  <p>Open the CACSA app on your phone. If nothing happens, install/open CACSA and continue.</p>
  <p><a href="${deep}">Open in app</a></p>
  <p style="word-break:break-all;font-size:12px;color:#666">${deep}</p>
</body></html>`);
});

router.use(firebaseAuthMiddleware);

router.get("/me", async (req, res) => {
  try {
    const firebaseUid = req.firebaseUser.uid;
    const webHost = process.env.FAMILY_JOIN_WEB_BASE
      ? String(process.env.FAMILY_JOIN_WEB_BASE).replace(/^https?:\/\//, "")
      : "";
    const data = await referralService.getMe(firebaseUid, webHost);
    res.json({ status: "success", ...data });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/capture", async (req, res) => {
  try {
    const firebaseUid = req.firebaseUser.uid;
    const { code } = req.body ?? {};
    const out = await referralService.capture({
      referredUid: firebaseUid,
      referralCode: code,
    });
    res.json({ status: "success", ...out });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
});

module.exports = router;
