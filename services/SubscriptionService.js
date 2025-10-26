const axios = require("axios");
const SubscriptionPlanModel = require("../models/SubscriptionPlanModel");

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
          // plan: plan,
          callback_url: `${process.env.BACKEND_URL}/paystack/callback`,
          uid,
          metadata: {
            cancel_action: `${process.env.BACKEND_URL}/payment/cancel`,
          },
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
      // Fetch plans from local database instead of Paystack
      const plans = await SubscriptionPlanModel.getAllPlans();
      return plans;
    } catch (error) {
      throw error;
    }
  }

  async initializePlanSubscription(email, planId, uid) {
    try {
      // Get plan from database
      const plan = await SubscriptionPlanModel.getPlanById(planId);

      if (!plan) {
        throw new Error("Plan not found");
      }

      // Convert amount from Naira to kobo (multiply by 100)
      const amountInKobo = plan.amount * 100;

      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: amountInKobo,
          callback_url: `${process.env.BACKEND_URL}/paystack/callback`,
          metadata: {
            cancel_action: `${process.env.BACKEND_URL}/payment/cancel`,
            plan_id: planId,
            plan_name: plan.name,
          },
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
      await this.subscriptionModel.addSubscription(
        uid,
        amountInKobo,
        email,
        response.data.data.reference,
        expirationDate
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async handleCallback(trxref, reference) {
    try {
      // Verify the transaction
      const verificationResult = await this.confirmSubscription(reference);

      if (verificationResult.status === "success") {
        // Update subscription status to active
        await this.updateSubscriptionStatus(reference, "active");

        return {
          success: true,
          message: "Payment verified successfully",
          data: verificationResult,
        };
      }

      return {
        success: false,
        message: "Payment verification failed",
        data: verificationResult,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }
}

module.exports = SubscriptionService;
