
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      message: "Email and password are required"
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing in .env");

    return res.status(500).json({
      message: "Server authentication configuration error"
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash, role
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (
      !user ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
        issuer: "legacy-ofs"
      }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login:", error.message);

    return res.status(500).json({
      message: "Login failed"
    });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (!result.rowCount) {
      return res.status(401).json({
        message: "User no longer exists"
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Current user:", error.message);

    return res.status(500).json({
      message: "Could not load user"
    });
  }
});

module.exports = router;
