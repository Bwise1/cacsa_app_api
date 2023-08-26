const express = require("express");
const router = express.Router();
const AuthService = require("../services/AuthService");

const authService = new AuthService();

router.post("/register", async (req, res) => {
  try {
    const newUser = req.body;
    await authService.registerUser(newUser);
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to register user", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const token = await authService.authenticateUser(username, password);
    if (token) {
      res.json({ message: "Login successful", token });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

module.exports = router;
