const axios = require("axios");
const SubscriptionPlanModel = require("../models/SubscriptionPlanModel");
const { verifyStudentCode } = require("../utils/studentCodeVerification");
const { activateSubscriptionSideEffects } = require("./chargeActivationService");

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
      const data = response.data.data;
      const { status, amount } = data;

      if (status === "success") {
        await this.subscriptionModel.updateSubscriptionStatus(reference, "active");
        await activateSubscriptionSideEffects(reference, data);
      }

      return { status, amount };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mobile app init: amount may be omitted when plan_id / plan resolves from DB (server-priced).
   * studentCode required for individual_student and family_student plans.
   */
  async initializeSubscription2(amount, email, uid, plan, planId, studentCode) {
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    let planRow = null;
    if (planId != null && planId !== "") {
      planRow = await SubscriptionPlanModel.getPlanById(Number(planId));
    }
    if (!planRow && plan) {
      planRow = await SubscriptionPlanModel.getPlanByPlanCode(String(plan));
    }
    if (!planRow && plan && /^\d+$/.test(String(plan))) {
      planRow = await SubscriptionPlanModel.getPlanById(Number(plan));
    }

    let amountKobo;
    const metadata = {
      cancel_action: `${process.env.BACKEND_URL}/payment/cancel`,
      uid: String(uid),
      email: String(email),
    };

    if (planRow) {
      const amountNaira = Number(planRow.amount);
      amountKobo = Math.round(amountNaira * 100);
      const kind = planRow.plan_kind || "individual";

      if (kind === "family_student" || kind === "individual_student") {
        const ok = await verifyStudentCode(planRow.plan_code, studentCode);
        if (!ok) {
          const err = new Error("Invalid student verification code");
          err.status = 400;
          throw err;
        }
      }

      if (kind === "family_regular" || kind === "family_student") {
        const tier = kind === "family_student" ? "student_family" : "standard_family";
        Object.assign(metadata, {
          plan_id: String(planRow.id),
          plan_code: planRow.plan_code || "",
          plan_kind: kind,
          plan_tier: tier,
          plan_type: "family",
        });
      } else {
        Object.assign(metadata, {
          plan_id: String(planRow.id),
          plan_code: planRow.plan_code || String(plan),
          plan_kind: kind,
          plan_type: "individual",
        });
      }
    } else {
      amountKobo = Math.round(Number(amount));
      Object.assign(metadata, {
        plan_code: plan ? String(plan) : "",
        plan_kind: "individual",
        plan_type: "individual",
      });
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        amount: amountKobo,
        email,
        callback_url: `${process.env.BACKEND_URL}/paystack/callback`,
        metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      }
    );

    await this.subscriptionModel.addSubscription(
      uid,
      amountKobo,
      email,
      response.data.data.reference,
      expirationDate
    );

    return response.data;
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
      const plans = await SubscriptionPlanModel.getAllPlans();
      return plans;
    } catch (error) {
      throw error;
    }
  }

  async initializePlanSubscription(email, planId, uid) {
    try {
      const plan = await SubscriptionPlanModel.getPlanById(planId);

      if (!plan) {
        throw new Error("Plan not found");
      }

      const amountInKobo = Math.round(Number(plan.amount) * 100);

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

      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);

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
      const verificationResult = await this.confirmSubscription(reference);

      if (verificationResult.status === "success") {
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
