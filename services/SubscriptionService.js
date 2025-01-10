const axios = require("axios");

class SubscriptionService {
  constructor(secretKey, subscriptionModel) {
    this.secretKey = secretKey;
    this.subscriptionModel = subscriptionModel;
  }

  async initializeSubscription(amount, email) {
    console.log("Initializing");
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          amount,
          email,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async confirmSubscription(reference) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      const { status, amount } = response.data.data;
      return { status, amount };
    } catch (error) {
      throw error;
    }
  }

  async initializeSubscription2(amount, email, uid, plan) {
    console.log("Initializing");
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          amount,
          email,
          callback_url: `${process.env.BACKEND_URL}/paystack/callback`,
          plan: plan,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );
      // Calculate expiration date (one year from the current date)
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);

      // Add the new subscription to the database
      const subscriptionId = await this.subscriptionModel.addSubscription(
        uid,
        amount,
        email,
        response.data.data.reference,
        expirationDate
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateSubscriptionStatus(reference, newStatus) {
    try {
      const result = await this.subscriptionModel.updateSubscriptionStatus(
        reference,
        newStatus
      );
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getAllPlans() {
    try {
      const response = await axios.get("https://api.paystack.co/plan", {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });
      const plans = response.data.data.map((plan) => ({
        name: plan.name,
        description: plan.description,
        amount: plan.amount,
        interval: plan.interval,
        currency: plan.currency,
        plan_code: plan.plan_code,
      }));
      return plans;
    } catch (error) {
      throw error;
    }
  }

  async initializePlanSubscription(email, planCode, amount) {
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          plan: planCode,
          amount,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = SubscriptionService;
