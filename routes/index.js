const Router = require("express");
const authController = require("../controllers/AuthController");
const categoryController = require("../controllers/categoryController");
const audioController = require("../controllers/audioController");
const subscriptionController = require("../controllers/SubscriptionController");
const statesController = require("../controllers/StatesController");
const branchesController = require("../controllers/BranchController");

const router = Router();

// app.get("/", async (req, res) => {
//   res.status(200).json({ message: "Version 1" });
// });

router.use("/auth", authController);

//categories endpoints
router.use("/category", categoryController);

//audio routes
router.use("/audio", audioController);

//subscription route
router.use("/paystack", subscriptionController);

//states route
router.use("/state", statesController);

//branches route
router.use("/branch", branchesController);

// app.post("/paystack/initialize-transaction", async (req, res) => {
//   try {
//     const { amount, email } = req.body;
//     const response = await axios.post(
//       "https://api.paystack.co/transaction/initialize",
//       {
//         amount,
//         email,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         },
//       }
//     );
//     res.json(response.data);
//   } catch (error) {
//     console.log(error);
//     res.status(error.response.status).json({ error: error.message });
//   }
// });

// // Confirm Paystack Transaction Status
// app.get("/paystack/confirm/:reference", async (req, res) => {
//   try {
//     const { reference } = req.params;
//     const response = await axios.get(
//       `https://api.paystack.co/transaction/verify/${reference}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );
//     const { status, amount } = response.data.data;
//     res.json({ status, amount });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Error confirming Paystack transaction status");
//   }
// });

module.exports = router;
