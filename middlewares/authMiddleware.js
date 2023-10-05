const jwt = require("jsonwebtoken");
const express = require("express");

require("dotenv").config(); // Load environment variables from .env

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({
      status: "failed",
      message: "Authentication failed. Token not provided.",
    });
  }

  try {
    const token = req.headers.authorization.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use process.env to access the secret key
    req.user = decoded.user;

    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({
      status: "failed",
      message: "Authentication failed. Invalid token.",
    });
  }
};

module.exports = authMiddleware;
