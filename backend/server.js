const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------- MIDDLEWARE --------------------

app.use(cors());
app.use(express.json());

// -------------------- BACKEND STATUS --------------------

app.get("/", (req, res) => {
  res.json({
    message: "Legacy OFS Backend is running!",
  });
});

// -------------------- DATABASE HEALTH CHECK --------------------

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      server: "OK",
      database: "Connected",
    });
  } catch (error) {
    console.error("Database health check:", error.message);

    res.status(500).json({
      server: "OK",
      database: "Connection failed",
    });
  }
});

// -------------------- GET ALL TICKETS --------------------

app.get("/api/tickets", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tickets ORDER BY id DESC"
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Fetch tickets:", error.message);

    res.status(500).json({
      error: "Could not fetch tickets",
    });
  }
});

// -------------------- CREATE TICKET --------------------

app.post("/api/tickets", async (req, res) => {
  const {
    ticket_number,
    template_name,
    customer_name,
    work_start_date,
    work_end_date,
    comments,
  } = req.body;

  if (
    !ticket_number ||
    !template_name ||
    !customer_name
  ) {
    return res.status(400).json({
      error:
        "Ticket number, template and customer are required",
    });
  }

  if (
    work_start_date &&
    work_end_date &&
    work_start_date > work_end_date
  ) {
    return res.status(400).json({
      error: "Work end date cannot be before start date",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tickets (
        ticket_number,
        template_name,
        customer_name,
        work_start_date,
        work_end_date,
        comments
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        String(ticket_number).trim(),
        String(template_name).trim(),
        String(customer_name).trim(),
        work_start_date || null,
        work_end_date || null,
        comments || null,
      ]
    );

    res.status(201).json({
      message: "Ticket created successfully",
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("Create ticket:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "Ticket number already exists",
      });
    }

    res.status(500).json({
      error: "Could not create ticket",
    });
  }
});

// -------------------- SEARCH AND FILTER TICKETS --------------------

app.get("/api/tickets/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const status = String(req.query.status || "").trim();

  try {
    const result = await pool.query(
      `SELECT *
       FROM tickets
       WHERE (
         COALESCE(ticket_number::text, '') ILIKE $1
         OR COALESCE(customer_name, '') ILIKE $1
       )
       AND ($2 = '' OR status = $2)
       ORDER BY id DESC`,
      [`%${q}%`, status]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Search tickets:", error.message);

    res.status(500).json({
      error: "Could not search tickets",
    });
  }
});

// -------------------- GET ONE TICKET --------------------

app.get("/api/tickets/:id", async (req, res) => {
  const ticketId = Number(req.params.id);

  if (!Number.isInteger(ticketId) || ticketId < 1) {
    return res.status(400).json({
      error: "Invalid ticket ID",
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM tickets WHERE id = $1",
      [ticketId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get ticket:", error.message);

    res.status(500).json({
      error: "Could not fetch ticket",
    });
  }
});

// -------------------- UPDATE TICKET DETAILS --------------------

app.patch("/api/tickets/:id", async (req, res) => {
  const ticketId = Number(req.params.id);

  if (!Number.isInteger(ticketId) || ticketId < 1) {
    return res.status(400).json({
      error: "Invalid ticket ID",
    });
  }

  const allowedFields = {
    ticket_number: "ticket_number",
    template_name: "template_name",
    customer_name: "customer_name",
    work_start_date: "work_start_date",
    work_end_date: "work_end_date",
    comments: "comments",
  };

  const updates = [];
  const values = [];
  let index = 1;

  for (const [field, column] of Object.entries(allowedFields)) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates.push(`${column} = $${index++}`);
      values.push(req.body[field] === "" ? null : req.body[field]);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({
      error: "No valid ticket fields provided",
    });
  }

  try {
    // Only draft and rejected tickets can be edited here.
    const existing = await pool.query(
      "SELECT status FROM tickets WHERE id = $1",
      [ticketId]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    if (!["Draft", "Rejected"].includes(existing.rows[0].status)) {
      return res.status(409).json({
        error: "Only Draft or Rejected tickets can be edited",
      });
    }

    values.push(ticketId);

    const result = await pool.query(
      `UPDATE tickets
       SET ${updates.join(", ")},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $${index}
       RETURNING *`,
      values
    );

    res.json({
      message: "Ticket updated successfully",
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("Update ticket:", error.message);

    res.status(500).json({
      error: "Could not update ticket",
    });
  }
});

// -------------------- TICKET STATUS WORKFLOW --------------------

app.patch("/api/tickets/:id/status", async (req, res) => {
  const ticketId = Number(req.params.id);
  const action = String(req.body.action || "").trim().toLowerCase();
  const rejectionReason = String(
    req.body.rejection_reason || ""
  ).trim();

  if (!Number.isInteger(ticketId) || ticketId < 1) {
    return res.status(400).json({
      error: "Invalid ticket ID",
    });
  }

  const transitions = {
    submit: {
      from: ["Draft", "Rejected"],
      to: "Submitted",
    },
    approve: {
      from: ["Submitted"],
      to: "Approved",
    },
    reject: {
      from: ["Submitted"],
      to: "Rejected",
    },
    invoice: {
      from: ["Approved"],
      to: "Invoiced",
    },
    void: {
      from: ["Draft", "Submitted", "Approved", "Rejected"],
      to: "Void",
    },
  };

  const transition = transitions[action];

  if (!transition) {
    return res.status(400).json({
      error:
        "Action must be submit, approve, reject, invoice or void",
    });
  }

  if (action === "reject" && !rejectionReason) {
    return res.status(400).json({
      error: "Rejection reason is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT * FROM tickets WHERE id = $1 FOR UPDATE",
      [ticketId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    const ticket = existing.rows[0];

    if (!transition.from.includes(ticket.status)) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: `Cannot ${action} a ticket with status ${ticket.status}`,
      });
    }

    const result = await client.query(
      `UPDATE tickets
       SET status = $1,
           rejection_reason = $2,
           reviewed_at = CASE
             WHEN $3 THEN CURRENT_TIMESTAMP
             ELSE reviewed_at
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        transition.to,
        action === "reject" ? rejectionReason : null,
        ["approve", "reject"].includes(action),
        ticketId,
      ]
    );

    await client.query("COMMIT");

    res.json({
      message: `Ticket ${action} successful`,
      ticket: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Ticket status update:", error.message);

    res.status(500).json({
      error: "Could not update ticket status",
    });
  } finally {
    client.release();
  }
});

// -------------------- 404 ROUTE --------------------

app.use((req, res) => {
  res.status(404).json({
    error: "API route not found",
    path: req.originalUrl,
  });
});

// -------------------- ERROR HANDLER --------------------

app.use((error, req, res, next) => {
  console.error("Unexpected error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Internal server error",
  });
});

// -------------------- START SERVER --------------------

const server = app.listen(PORT, () => {
  console.log(`Legacy OFS server running on http://localhost:${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down server...");

  server.close(async () => {
    try {
      await pool.end();
      console.log("Database pool closed");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error.message);
      process.exit(1);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
