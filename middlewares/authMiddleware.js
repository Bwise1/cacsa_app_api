const jwt = require("jsonwebtoken");

require("dotenv").config();

const authMiddleware = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res.status(401).json({
      status: "failed",
      message: "Authentication failed. Token not provided.",
    });
  }

  try {
    const raw = authHeader.split(" ")[1];
    if (!raw) {
      return res.status(401).json({
        status: "failed",
        message: "Authentication failed. Malformed Authorization header.",
      });
    }

    const decoded = jwt.verify(raw, process.env.JWT_SECRET);
    if (decoded.tokenType === "refresh") {
      return res.status(401).json({
        status: "failed",
        message: "Use an access token, not a refresh token.",
      });
    }
    req.user = {
      id: decoded.id,
      role: decoded.role,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
    };
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
