
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access token required"
    });
  }

  const token = authHeader.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing in .env");

    return res.status(500).json({
      message: "Server authentication configuration error"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "legacy-ofs"
    });

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired. Please log in again."
      });
    }

    return res.status(401).json({
      message: "Invalid authentication token"
    });
  }
}

module.exports = authenticateToken;
