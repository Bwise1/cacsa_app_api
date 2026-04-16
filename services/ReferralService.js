const crypto = require("crypto");
const ReferralModel = require("../models/ReferralModel");
const { DevotionalService } = require("./DevotionalService");

const REFERRAL_CODE_LENGTH = 8;
const DEFAULT_REWARD_POINTS = 100;

function makeCode() {
  return crypto
    .randomBytes(8)
    .toString("base64")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, REFERRAL_CODE_LENGTH);
}

class ReferralService {
  constructor() {
    this.model = new ReferralModel();
    this.devotionalService = new DevotionalService();
  }

  async getOrCreateCode(firebaseUid) {
    const existing = await this.model.getCodeByUid(firebaseUid);
    if (existing) return existing;

    for (let i = 0; i < 8; i += 1) {
      const code = makeCode();
      try {
        await this.model.createCode(firebaseUid, code);
        return await this.model.getCodeByUid(firebaseUid);
      } catch (e) {
        if (e.code !== "ER_DUP_ENTRY") throw e;
      }
    }
    throw new Error("Could not generate referral code");
  }

  async getMe(firebaseUid, webHost) {
    const code = await this.getOrCreateCode(firebaseUid);
    const stats = await this.model.getMeStats(firebaseUid);
    const progress = await this.devotionalService.getProgress(firebaseUid);
    const referralCode = stats.code || code.code;
    const shareUrl =
      webHost && String(webHost).trim() !== ""
        ? `https://${String(webHost).trim()}/referral/join?r=${encodeURIComponent(referralCode)}`
        : `cacsa://referral/join?r=${encodeURIComponent(referralCode)}`;
    return {
      code: referralCode,
      shareUrl,
      pendingCount: stats.pendingCount,
      convertedCount: stats.convertedCount,
      rejectedCount: stats.rejectedCount,
      currentStreakDays: progress.currentStreakDays,
      monthPoints: progress.monthPoints,
      totalPoints: progress.totalPoints,
      rank: progress.rank,
      rankColorHex: progress.rankColorHex,
    };
  }

  async capture({ referredUid, referralCode }) {
    const cleanedCode = String(referralCode || "").trim().toUpperCase();
    if (!cleanedCode) throw new Error("referral code is required");

    const codeRow = await this.model.getCodeRow(cleanedCode);
    if (!codeRow || !codeRow.is_active) {
      throw new Error("Invalid referral code");
    }
    if (codeRow.firebase_uid === referredUid) {
      await this.model.upsertAttribution({
        referredUid,
        referrerUid: referredUid,
        referralCode: cleanedCode,
        status: "rejected",
        rejectedReason: "self_referral",
      });
      throw new Error("You cannot refer yourself");
    }

    const existing = await this.model.getAttributionByReferredUid(referredUid);
    if (existing && existing.status === "converted") {
      return {
        outcome: "already_converted",
        message: "You already used a referral code when you subscribed.",
      };
    }
    if (existing && existing.status === "pending") {
      const existingCode = String(existing.referral_code || "").trim().toUpperCase();
      if (existingCode === cleanedCode) {
        return {
          outcome: "already_pending",
          message: "This referral code is already applied to your account.",
        };
      }
      throw new Error(
        "You already applied a different referral code. It cannot be changed."
      );
    }

    await this.model.upsertAttribution({
      referredUid,
      referrerUid: codeRow.firebase_uid,
      referralCode: cleanedCode,
      status: "pending",
      rejectedReason: null,
    });
    return { outcome: "captured", message: "Referral captured" };
  }

  async convertOnFirstPaidSubscription({ referredUid, subscriptionId, executor = null }) {
    if (!referredUid) return { converted: false, reason: "missing_uid" };
    const attribution = await this.model.getAttributionByReferredUid(
      referredUid,
      executor
    );
    if (!attribution) return { converted: false, reason: "no_attribution" };
    if (attribution.status === "converted") {
      return { converted: false, reason: "already_converted" };
    }
    if (attribution.status !== "pending") {
      return { converted: false, reason: "not_pending" };
    }

    try {
      await this.model.insertConversion({
        attributionId: attribution.id,
        subscriptionId,
        rewardPoints: DEFAULT_REWARD_POINTS,
      }, executor);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return { converted: false, reason: "duplicate_conversion" };
      }
      throw e;
    }

    await this.model.markConverted(attribution.id, executor);
    return {
      converted: true,
      attributionId: attribution.id,
      referrerUid: attribution.referrer_uid,
      rewardPoints: DEFAULT_REWARD_POINTS,
    };
  }

  async listAdmin({ q, status, limit }) {
    return this.model.listAdminReferrals({ q, status, limit });
  }
}

module.exports = { ReferralService };
