const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, fields
       FROM ticket_templates
       WHERE is_active=TRUE ORDER BY id`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Templates:", error.message);
    res.status(500).json({ message: "Could not load templates" });
  }
});

router.post(
  "/",
  authenticateToken,
  requireRole("Administrator"),
  async (req, res) => {
    const { name, description = "", fields = [] } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !Array.isArray(fields)
    ) {
      return res.status(400).json({ message: "Invalid template" });
    }

    if (fields.length > 50) {
      return res.status(400).json({ message: "Too many template fields" });
    }

    try {
      const result = await pool.query(
        `INSERT INTO ticket_templates (name, description, fields)
         VALUES ($1,$2,$3)
         ON CONFLICT (name) DO UPDATE SET
         description=EXCLUDED.description,
         fields=EXCLUDED.fields,
         is_active=TRUE
         RETURNING *`,
        [name.trim(), description, JSON.stringify(fields)]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Save template:", error.message);
      res.status(500).json({ message: "Could not save template" });
    }
  }
);

module.exports = router;