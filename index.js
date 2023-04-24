const express = require("express");
const axios = require("axios");

const app = express();
require("dotenv").config();

app.use(express.json());

const port = process.env.PORT || 3000;
app.post("/initialize-transaction", async (req, res) => {
  try {
    const { amount, email } = req.body;
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        amount,
        email,
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

app.listen(port, () => {
  console.log("Server listening on port ", port);
});
