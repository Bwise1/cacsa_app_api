const express = require("express");
const router = express.Router();
const SubscriptionService = require("../services/SubscriptionService");

const subscriptionService = new SubscriptionService(
  process.env.PAYSTACK_SECRET_KEY
);

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

module.exports = router;
