const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

router.post("/:ticketId/line-items", authenticateToken, async (req, res) => {
  const { description, item_type, quantity, unit_price } = req.body;
  const qty = Number(quantity);
  const price = Number(unit_price);

  if (
    typeof description !== "string" ||
    !description.trim() ||
    !["service", "material"].includes(item_type) ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return res.status(400).json({
      message: "Invalid line item description, type, quantity or price"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT * FROM tickets WHERE id=$1 FOR UPDATE`,
      [req.params.ticketId]
    );

    const ticket = result.rows[0];

    if (
      !ticket ||
      (req.user.role !== "Administrator" &&
        String(ticket.created_by) !== String(req.user.id))
    ) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!["Draft", "Rejected"].includes(ticket.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Line items can only be changed on Draft or Rejected tickets"
      });
    }

    const inserted = await client.query(
      `INSERT INTO ticket_line_items
       (ticket_id, description, item_type, quantity, unit_price)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *,
       quantity * unit_price AS line_total`,
      [
        req.params.ticketId,
        description.trim(),
        item_type,
        qty,
        price
      ]
    );

    await client.query("COMMIT");
    res.status(201).json(inserted.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Add line item:", error.message);
    res.status(500).json({ message: "Could not add line item" });
  } finally {
    client.release();
  }
});

router.get("/:ticketId/line-items", authenticateToken, async (req, res) => {
  try {
    const ticket = await pool.query(
      `SELECT id, created_by FROM tickets WHERE id=$1
       AND ($2='Administrator' OR created_by=$3)`,
      [req.params.ticketId, req.user.role, req.user.id]
    );

    if (!ticket.rowCount) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const result = await pool.query(
      `SELECT *, quantity * unit_price AS line_total
       FROM ticket_line_items WHERE ticket_id=$1 ORDER BY id`,
      [req.params.ticketId]
    );

    const total = result.rows.reduce(
      (sum, item) => sum + Number(item.line_total),
      0
    );

    res.json({ items: result.rows, total });
  } catch (error) {
    console.error("List line items:", error.message);
    res.status(500).json({ message: "Could not load line items" });
  }
});

module.exports = router;