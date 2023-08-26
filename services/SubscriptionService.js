const axios = require("axios");

class SubscriptionService {
  constructor(secretKey) {
    this.secretKey = secretKey;
  }

  async initializeSubscription(amount, email) {
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
}

module.exports = SubscriptionService;
