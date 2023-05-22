const express = require("express");
const axios = require("axios");

const app = express();
require("dotenv").config();

app.use(express.json());

const port = process.env.PORT || 3000;
const plan = process.env.PAYSTACK_PLAN_CODE;
app.post("/paystack/initialize-transaction", async (req, res) => {
  try {
    const { amount, email } = req.body;
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        amount,
        email
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.log(error);
    res.status(error.response.status).json({ error: error.message });
  }
});

// Confirm Paystack Transaction Status
app.get("/paystack/confirm/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const { status, amount } = response.data.data;
    res.json({ status, amount });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error confirming Paystack transaction status");
  }
});

app.listen(port, () => {
  console.log("Server listening on port ", port);
});
