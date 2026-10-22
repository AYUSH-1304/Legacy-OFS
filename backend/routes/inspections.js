const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

router.post("/:ticketId/inspections", authenticateToken, async (req, res) => {
  const { inspection_date, findings = "", result } = req.body;

  if (
    !["Pass", "Fail", "Needs Maintenance"].includes(result) ||
    typeof findings !== "string"
  ) {
    return res.status(400).json({ message: "Invalid inspection data" });
  }

  try {
    const ticket = await pool.query(
      `SELECT id FROM tickets WHERE id=$1
       AND ($2='Administrator' OR created_by=$3)`,
      [req.params.ticketId, req.user.role, req.user.id]
    );

    if (!ticket.rowCount) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const saved = await pool.query(
      `INSERT INTO inspections
       (ticket_id, inspector_id, inspection_date, findings, result)
       VALUES ($1,$2,COALESCE($3::date,CURRENT_DATE),$4,$5)
       RETURNING *`,
      [
        req.params.ticketId,
        req.user.id,
        inspection_date || null,
        findings,
        result
      ]
    );

    res.status(201).json(saved.rows[0]);
  } catch (error) {
    console.error("Save inspection:", error.message);
    res.status(500).json({ message: "Could not save inspection" });
  }
});

router.get("/:ticketId/inspections", authenticateToken, async (req, res) => {
  try {
    const ticket = await pool.query(
      `SELECT id FROM tickets WHERE id=$1
       AND ($2='Administrator' OR created_by=$3)`,
      [req.params.ticketId, req.user.role, req.user.id]
    );

    if (!ticket.rowCount) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const result = await pool.query(
      `SELECT * FROM inspections WHERE ticket_id=$1 ORDER BY created_at DESC`,
      [req.params.ticketId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("List inspections:", error.message);
    res.status(500).json({ message: "Could not load inspections" });
  }
});

router.post("/:ticketId/maintenance", authenticateToken, async (req, res) => {
  const {
    maintenance_type,
    description,
    comments = ""
  } = req.body;

  if (
    typeof maintenance_type !== "string" ||
    !maintenance_type.trim() ||
    typeof description !== "string" ||
    !description.trim()
  ) {
    return res.status(400).json({
      message: "Maintenance type and description are required"
    });
  }

  try {
    const ticket = await pool.query(
      `SELECT id FROM tickets WHERE id=$1
       AND ($2='Administrator' OR created_by=$3)`,
      [req.params.ticketId, req.user.role, req.user.id]
    );

    if (!ticket.rowCount) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const saved = await pool.query(
      `INSERT INTO maintenance_records
       (ticket_id, created_by, maintenance_type, description, comments)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        req.params.ticketId,
        req.user.id,
        maintenance_type.trim(),
        description.trim(),
        comments
      ]
    );

    res.status(201).json(saved.rows[0]);
  } catch (error) {
    console.error("Save maintenance:", error.message);
    res.status(500).json({ message: "Could not save maintenance record" });
  }
});

module.exports = router;