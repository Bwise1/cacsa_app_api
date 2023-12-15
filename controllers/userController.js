const express = require("express");
const UserService = require("../services/UserService");

const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();
const userService = new UserService();

router.get("/", async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json({ status: "success", users: users });
  } catch (error) {
    console.error("Error in the controller", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
