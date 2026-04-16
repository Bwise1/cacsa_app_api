const Router = require("express");
const authController = require("../controllers/AuthController");
const categoryController = require("../controllers/categoryController");
const audioController = require("../controllers/audioController");
const subscriptionController = require("../controllers/SubscriptionController");
const familyController = require("../controllers/FamilyController");
const statesController = require("../controllers/StatesController");
const branchesController = require("../controllers/BranchController");
const userController = require("../controllers/userController");
const adminController = require("../controllers/AdminController");
const appConfigController = require("../controllers/AppConfigController");
const adsController = require("../controllers/AdsController");
const referralsController = require("../controllers/ReferralsController");
const devotionalController = require("../controllers/DevotionalController");

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

router.use("/family", familyController);

//states route
router.use("/state", statesController);

//branches route
router.use("/branch", branchesController);

//user route
router.use("/user", userController);

router.use("/ads", adsController);
router.use("/referrals", referralsController);
router.use("/devotionals", devotionalController);

router.use("/admin", adminController);
router.use("/app-config", appConfigController);

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
