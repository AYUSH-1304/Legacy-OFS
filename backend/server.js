
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

// Test backend
app.get("/", (req, res) => {
  res.json({ message: "Legacy OFS Backend is running!" });
});

// Check database connection
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ server: "OK", database: "Connected" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ database: "Connection failed" });
  }
});

// Get all tickets
app.get("/api/tickets", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tickets ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Could not fetch tickets" });
  }
});

// Create a ticket
app.post("/api/tickets", async (req, res) => {
  const {
    ticket_number,
    template_name,
    customer_name,
    work_start_date,
    work_end_date,
    comments,
  } = req.body;

  if (!ticket_number || !template_name || !customer_name) {
    return res.status(400).json({
      error: "Ticket number, template and customer are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tickets
       (ticket_number, template_name, customer_name,
        work_start_date, work_end_date, comments)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        ticket_number,
        template_name,
        customer_name,
        work_start_date || null,
        work_end_date || null,
        comments || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Could not create ticket" });
  }
});

const PORT = process.env.PORT || 5000;

/* Add these routes in server.js before app.listen(...) */

// Search and filter tickets
app.get("/api/tickets/search", async (req, res) => {
  const { q = "", status = "" } = req.query;

  try {
    const result = await pool.query(
      `SELECT *
       FROM tickets
       WHERE (
         ticket_number ILIKE $1
         OR customer_name ILIKE $1
       )
       AND ($2 = '' OR status = $2)
       ORDER BY id DESC`,
      [`%${q}%`, status]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Ticket search:", error.message);
    res.status(500).json({ error: "Could not search tickets" });
  }
});

// Change ticket status
app.patch("/api/tickets/:id/status", async (req, res) => {
  const ticketId = Number(req.params.id);
  const { action, rejection_reason } = req.body;

  if (!Number.isInteger(ticketId) || ticketId < 1) {
    return res.status(400).json({ error: "Invalid ticket ID" });
  }

  const transitions = {
    submit: { from: ["Draft"], to: "Submitted" },
    approve: { from: ["Submitted"], to: "Approved" },
    reject: { from: ["Submitted"], to: "Rejected" },
    invoice: { from: ["Approved"], to: "Invoiced" },
    void: {
      from: ["Draft", "Submitted", "Approved", "Rejected"],
      to: "Void",
    },
  };

  const transition = transitions[action];

  if (!transition) {
    return res.status(400).json({
      error: "Action must be submit, approve, reject, invoice or void",
    });
  }

  if (
    action === "reject" &&
    !String(rejection_reason || "").trim()
  ) {
    return res.status(400).json({
      error: "Rejection reason is required",
    });
  }

  try {
    const existing = await pool.query(
      "SELECT * FROM tickets WHERE id = $1",
      [ticketId]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = existing.rows[0];

    if (!transition.from.includes(ticket.status)) {
      return res.status(409).json({
        error: `Cannot ${action} a ticket with status ${ticket.status}`,
      });
    }

    const isReview = ["approve", "reject"].includes(action);

    const result = await pool.query(
      `UPDATE tickets
       SET status = $1,
           rejection_reason = $2,
           reviewed_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP
                              ELSE reviewed_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        transition.to,
        action === "reject"
          ? String(rejection_reason).trim()
          : null,
        isReview,
        ticketId,
      ]
    );

    res.json({
      message: `Ticket ${action} successful`,
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("Status update:", error.message);
    res.status(500).json({ error: "Could not update ticket status" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
