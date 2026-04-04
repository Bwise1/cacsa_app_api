const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { firebaseAuthMiddleware } = require("../middlewares/firebaseAuthMiddleware");
const FamilyModel = require("../models/FamilyModel");
const { sendFamilyInviteEmail } = require("../utils/emailService");
const { syncSubscriptionToFirestore } = require("../services/subscriptionFirestoreSyncService");
const {
  checkInviteeCanBeInvited,
} = require("../services/familyInviteEligibilityService");

const INVITE_TTL_DAYS = 14;
const MAX_INVITES = 4;

function tierLabel(planTier) {
  if (planTier === "student_family") return "Student Family";
  if (planTier === "standard_family") return "Regular Family";
  return "Family";
}

/**
 * Owner: invite up to 4 emails (5 seats total including owner).
 */
router.post("/invite", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { emails } = req.body;
    const ownerUid = req.firebaseUser.uid;
    const ownerEmail = req.firebaseUser.email;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "emails array required" });
    }
    if (emails.length > MAX_INVITES) {
      return res.status(400).json({ error: `Maximum ${MAX_INVITES} invites per request` });
    }

    const family = await FamilyModel.getFamilyByOwnerUid(ownerUid);
    if (!family) {
      return res.status(404).json({ error: "No active family subscription for this account" });
    }

    const occupied = await FamilyModel.countOccupiedSeats(family.id);
    const remaining = family.max_seats - occupied;
    if (remaining <= 0) {
      return res.status(400).json({ error: "All family seats are full" });
    }
    if (emails.length > remaining) {
      return res.status(400).json({
        error: `Only ${remaining} seat(s) available`,
      });
    }

    const normOwner = FamilyModel.normalizeEmail(ownerEmail);
    const results = [];

    for (const raw of emails) {
      const emailNormalized = FamilyModel.normalizeEmail(raw);
      if (!emailNormalized.includes("@")) {
        results.push({ email: raw, ok: false, error: "Invalid email" });
        continue;
      }
      if (emailNormalized === normOwner) {
        results.push({ email: raw, ok: false, error: "Cannot invite owner email" });
        continue;
      }

      try {
        const eligibility = await checkInviteeCanBeInvited(emailNormalized);
        if (!eligibility.ok) {
          results.push({ email: raw, ok: false, error: eligibility.error });
          continue;
        }
      } catch (e) {
        console.error("checkInviteeCanBeInvited", e);
        results.push({
          email: raw,
          ok: false,
          error: "Could not verify this email. Try again.",
        });
        continue;
      }

      try {
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = FamilyModel.hashToken(token);
        const inviteExpiresAt = new Date(
          Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
        );

        await FamilyModel.createPendingInvite({
          familyId: family.id,
          emailNormalized,
          tokenHash,
          inviteExpiresAt,
        });

        await sendFamilyInviteEmail({
          toEmail: raw.trim(),
          inviteToken: token,
          inviterEmail: ownerEmail,
          tierLabel: tierLabel(family.plan_tier),
        });

        results.push({ email: raw, ok: true });
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY") {
          results.push({ email: raw, ok: false, error: "Already invited or member" });
        } else {
          console.error(e);
          results.push({ email: raw, ok: false, error: "Failed to create invite" });
        }
      }
    }

    res.json({ results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Invitee accepts after Firebase sign-in.
 * Student Family: no student code required — the purchaser already verified; invite + email match is enough.
 */
router.post("/accept", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "token required" });
    }

    const tokenHash = FamilyModel.hashToken(token.trim());
    const member = await FamilyModel.findMemberByInviteHash(tokenHash);

    if (!member) {
      return res.status(400).json({ error: "Invalid or expired invite" });
    }
    if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
      return res.status(400).json({ error: "Invite has expired" });
    }
    if (member.family_status !== "active") {
      return res.status(400).json({ error: "Family subscription is not active" });
    }
    if (new Date(member.family_expires_at) < new Date()) {
      return res.status(400).json({ error: "Family subscription has expired" });
    }

    const emailNorm = FamilyModel.normalizeEmail(req.firebaseUser.email);
    if (emailNorm !== member.email_normalized) {
      return res.status(403).json({
        error: "Sign in with the email address this invite was sent to.",
        expectedEmailDomain: member.email_normalized.split("@")[1],
      });
    }

    const uid = req.firebaseUser.uid;

    await FamilyModel.updateMemberAccepted({
      memberId: member.id,
      uid,
      studentVerified: member.plan_tier === "student_family",
    });

    await syncSubscriptionToFirestore(uid);

    res.json({ success: true, familyId: member.family_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Invitee accepts using Firebase session only (email must match pending row).
 */
router.post("/accept-pending", firebaseAuthMiddleware, async (req, res) => {
  try {
    const email = req.firebaseUser.email;
    if (!email) {
      return res.status(400).json({ error: "Signed-in account has no email" });
    }
    const emailNorm = FamilyModel.normalizeEmail(email);
    const member = await FamilyModel.findPendingMemberForAcceptByEmail(emailNorm);

    if (!member) {
      return res.status(400).json({ error: "No pending invite for this account" });
    }
    if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
      return res.status(400).json({ error: "Invite has expired" });
    }
    if (member.family_status !== "active") {
      return res.status(400).json({ error: "Family subscription is not active" });
    }
    if (new Date(member.family_expires_at) < new Date()) {
      return res.status(400).json({ error: "Family subscription has expired" });
    }

    const uid = req.firebaseUser.uid;

    await FamilyModel.updateMemberAccepted({
      memberId: member.id,
      uid,
      studentVerified: member.plan_tier === "student_family",
    });

    await syncSubscriptionToFirestore(uid);

    res.json({ success: true, familyId: member.family_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Invitee declines: removes their pending member row.
 */
router.post("/decline-pending", firebaseAuthMiddleware, async (req, res) => {
  try {
    const email = req.firebaseUser.email;
    if (!email) {
      return res.status(400).json({ error: "Signed-in account has no email" });
    }
    const norm = FamilyModel.normalizeEmail(email);
    const n = await FamilyModel.declinePendingInviteForEmail(norm);
    if (n === 0) {
      return res.status(404).json({ error: "No pending invite to decline" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Whether the signed-in user's email has a pending family invite (not yet accepted).
 */
router.get("/pending-invite", firebaseAuthMiddleware, async (req, res) => {
  try {
    const email = req.firebaseUser.email;
    if (!email) {
      return res.status(400).json({ error: "Signed-in account has no email" });
    }
    const norm = FamilyModel.normalizeEmail(email);
    const row = await FamilyModel.findPendingInviteForEmail(norm);
    if (!row) {
      return res.json({ hasPendingInvite: false });
    }
    res.json({
      hasPendingInvite: true,
      planTier: row.plan_tier,
      inviteExpiresAt: row.invite_expires_at,
      familyId: row.family_id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/me", firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.firebaseUser.uid;
    let family = await FamilyModel.getFamilyByOwnerUid(uid);

    if (!family) {
      const db = require("../db/db");
      const [rows] = await db.query(
        `SELECT fg.* FROM family_members fm
         JOIN family_groups fg ON fg.id = fm.family_id
         WHERE fm.uid = ? AND fm.status = 'active' LIMIT 1`,
        [uid]
      );
      family = rows[0] || null;
    }

    if (!family) {
      return res.json({ family: null, members: [] });
    }

    const members = await FamilyModel.listMembers(family.id);
    const isOwner = family.owner_uid === uid;

    res.json({
      family: {
        id: family.id,
        ownerUid: family.owner_uid,
        planTier: family.plan_tier,
        maxSeats: family.max_seats,
        expiresAt: family.expires_at,
        isOwner,
      },
      members,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/member/:targetUid", firebaseAuthMiddleware, async (req, res) => {
  try {
    const ownerUid = req.firebaseUser.uid;
    const { targetUid } = req.params;

    const family = await FamilyModel.getFamilyByOwnerUid(ownerUid);
    if (!family) {
      return res.status(403).json({ error: "Only the family owner can remove members" });
    }

    await FamilyModel.removeMemberByUid(family.id, targetUid, ownerUid);

    try {
      await syncSubscriptionToFirestore(targetUid);
    } catch (e) {
      console.warn("Firestore sync after member remove:", e.message);
    }

    res.json({ success: true });
  } catch (error) {
    if (error.message === "Forbidden") {
      return res.status(403).json({ error: "Forbidden" });
    }
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/invite", firebaseAuthMiddleware, async (req, res) => {
  try {
    const ownerUid = req.firebaseUser.uid;
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ error: "email query required" });
    }

    const family = await FamilyModel.getFamilyByOwnerUid(ownerUid);
    if (!family) {
      return res.status(403).json({ error: "Only the family owner can revoke invites" });
    }

    await FamilyModel.revokePendingByEmail(
      family.id,
      FamilyModel.normalizeEmail(email),
      ownerUid
    );
    res.json({ success: true });
  } catch (error) {
    if (error.message === "Forbidden") {
      return res.status(403).json({ error: "Forbidden" });
    }
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Simple landing page with app deep link (for email clients that open HTTPS).
 */
router.get("/join", (req, res) => {
  const token = req.query.t || "";
  const deep = `cacsa://family/join?t=${encodeURIComponent(token)}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width"/><title>Join family</title></head>
<body style="font-family:system-ui;padding:24px;">
  <h2>CACSA family invite</h2>
  <p>Open the CACSA app on your phone. If nothing happens, copy this link into the app or install CACSA from the store.</p>
  <p><a href="${deep}">Open in app</a></p>
  <p style="word-break:break-all;font-size:12px;color:#666">${deep}</p>
</body></html>`);
});

module.exports = router;
