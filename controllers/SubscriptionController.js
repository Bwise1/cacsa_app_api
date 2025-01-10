const express = require("express");
const router = express.Router();
const SubscriptionService = require("../services/SubscriptionService");
const SubscriptionModel = require("../models/SubscriptionModel");
const subscriptionService = new SubscriptionService(
  process.env.PAYSTACK_SECRET_KEY,
  SubscriptionModel
);
const { subscriptionsCollection } = require("../utils/firebase/index");

router.post("/v1/initialize-transaction", async (req, res) => {
  try {
    const { amount, email, uid, plan } = req.body;
    console.log("from app", req.body);
    const response = await subscriptionService.initializeSubscription2(
      amount,
      email,
      uid,
      plan
    );
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(error.status).json({ error: error.message });
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

// router.post("/webhook-url", async (req, res) => {
//   console.log("Webhook called", req.body);
//   try {
//     if (req.body.event === "charge.success") {
//       const reference = req.body.data.reference;
//       const transaction = await subscriptionService.updateSubscriptionStatus(
//         reference,
//         "active"
//       );

//       // Get the uid and email from the transaction
//       const { uid, email } = transaction;

//       // Write the uid, email, and status to Firestore
//       const docRef = subscriptionsCollection.doc(uid);
//       await docRef.set(
//         { userID: uid, email, status: "active" },
//         { merge: true }
//       );
//     }
//     res.sendStatus(200);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: error.message });
//   }
// });

router.post("/webhook-url", async (req, res) => {
  console.log("Webhook called", req.body);
  try {
    if (req.body.event === "charge.success") {
      const reference = req.body.data.reference;
      const transaction = await subscriptionService.updateSubscriptionStatus(
        reference,
        "active"
      );

      // Get the uid and email from the transaction
      const { uid, email } = transaction;

      // Write the uid, email, and status to Firestore
      const docRef = subscriptionsCollection.doc(uid);
      await docRef.set(
        { userID: uid, email, status: "active" },
        { merge: true }
      );

      // Redirect to the callback URL if provided, with success status
      const callbackUrl = req.body.data.metadata?.callback_url;
      if (callbackUrl) {
        return res.redirect(
          303,
          `${callbackUrl}?status=success&reference=${reference}`
        );
      }
    }

    if (req.body.event === "subscription.cancelled") {
      const reference = req.body.data.reference;
      const transaction = await subscriptionService.updateSubscriptionStatus(
        reference,
        "cancelled"
      );

      const { uid } = transaction;

      // Update Firestore status to cancelled
      const docRef = subscriptionsCollection.doc(uid);
      await docRef.set({ status: "cancelled" }, { merge: true });

      // Redirect to the callback URL if provided, with cancelled status
      const callbackUrl = req.body.data.metadata?.callback_url;
      if (callbackUrl) {
        return res.redirect(
          303,
          `${callbackUrl}?status=cancelled&reference=${reference}`
        );
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    // Redirect to callback URL with error if provided
    const callbackUrl = req.body?.data?.metadata?.callback_url;
    if (callbackUrl) {
      return res.redirect(
        303,
        `${callbackUrl}?status=error&message=${encodeURIComponent(
          error.message
        )}`
      );
    }
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
    const { amount, email, plan } = req.body;
    const response = await subscriptionService.initializePlanSubscription(
      email,
      plan,
      amount
    );
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
