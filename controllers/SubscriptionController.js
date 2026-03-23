const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const SubscriptionService = require("../services/SubscriptionService");
const SubscriptionModel = require("../models/SubscriptionModel");
const { activateSubscriptionSideEffects } = require("../services/chargeActivationService");

const subscriptionService = new SubscriptionService(
  process.env.PAYSTACK_SECRET_KEY,
  SubscriptionModel
);

router.post("/v1/initialize-transaction", async (req, res) => {
  try {
    const { amount, email, uid, plan, planId, studentCode } = req.body;
    console.log("from app", req.body);
    const response = await subscriptionService.initializeSubscription2(
      amount,
      email,
      uid,
      plan,
      planId,
      studentCode
    );
    res.json(response);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.post("/initialize-transaction", async (req, res) => {
  try {
    const { amount, email } = req.body;
    const response = await subscriptionService.initializeSubscription(
      amount,
      email
    );
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(error.response.status).json({ error: error.message });
  }
});

router.get("/confirm/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await subscriptionService.confirmSubscription(reference);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error confirming subscription status");
  }
});

function verifyPaystackSignature(req) {
  if (process.env.PAYSTACK_VERIFY_WEBHOOK !== "true") {
    return true;
  }
  const paystackSignature = req.headers["x-paystack-signature"];
  if (!paystackSignature) return false;
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest("hex");
  return hash === paystackSignature;
}

router.post("/webhook-url", async (req, res) => {
  console.log("Webhook called", req.body);
  try {
    if (!verifyPaystackSignature(req)) {
      console.error("Invalid Paystack signature");
      return res.status(400).send("Invalid signature");
    }
    if (req.body.event === "charge.success") {
      const reference = req.body.data.reference;
      await subscriptionService.updateSubscriptionStatus(reference, "active");
      await activateSubscriptionSideEffects(reference, req.body.data);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/plans", async (req, res) => {
  try {
    const plans = await subscriptionService.getAllPlans();
    res.json(plans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/init-plan-subscription", async (req, res) => {
  try {
    const { email, planId, uid } = req.body;
    const response = await subscriptionService.initializePlanSubscription(
      email,
      planId,
      uid
    );
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/callback", async (req, res) => {
  try {
    const { trxref, reference } = req.query;
    const result = await subscriptionService.handleCallback(trxref, reference);
    if (result.success) {
      return res.redirect("/payment/success");
    } else {
      return res.redirect("/payment/failed");
    }
  } catch (error) {
    return res.redirect("/payment/error");
  }
});

module.exports = router;
