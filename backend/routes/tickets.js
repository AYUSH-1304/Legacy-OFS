
const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

const VALID_STATUSES = [
  "Draft",
  "Submitted",
  "Approved",
  "Rejected",
  "Invoiced",
  "Void"
];

const ADMIN = "admin";
const WORKER = "field_worker";

function validateTicket(body = {}) {
  const ticketNumber = body.ticket_number ?? body.title;

  if (
    typeof ticketNumber !== "string" ||
    !ticketNumber.trim()
  ) {
    return "Ticket number is required";
  }

  if (ticketNumber.trim().length > 200) {
    return "Ticket number cannot exceed 200 characters";
  }

  const templateName = body.template_name ?? "Field Service Ticket";

  if (
    typeof templateName !== "string" ||
    !templateName.trim()
  ) {
    return "Template name is required";
  }

  if (
    typeof body.customer_name !== "string" ||
    !body.customer_name.trim()
  ) {
    return "Customer name is required";
  }

  if (
    body.work_start_date &&
    body.work_end_date &&
    body.work_end_date < body.work_start_date
  ) {
    return "End date cannot be before start date";
  }

  return null;
}

function canAccessTicket(ticket, user) {
  return (
    user.role === ADMIN ||
    String(ticket.created_by) === String(user.id)
  );
}

async function findTicket(client, id) {
  const result = await client.query(
    "SELECT * FROM tickets WHERE id = $1 FOR UPDATE",
    [id]
  );

  return result.rows[0];
}

// GET /api/tickets
// Admin can see all tickets; field workers see their own.
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    const params = [];
    const conditions = [];

    if (req.user.role !== ADMIN) {
      params.push(req.user.id);
      conditions.push(`created_by = $${params.length}`);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid status"
        });
      }

      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (search) {
      params.push(`%${String(search).slice(0, 100)}%`);
      conditions.push(
        `(ticket_number ILIKE $${params.length}
          OR customer_name ILIKE $${params.length}
          OR template_name ILIKE $${params.length})`
      );
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT * FROM tickets
       ${where}
       ORDER BY created_at DESC NULLS LAST, id DESC
       LIMIT 200`,
      params
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("List tickets:", error);
    return res.status(500).json({
      message: "Could not load tickets"
    });
  }
});

// GET /api/tickets/:id
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tickets WHERE id = $1",
      [req.params.id]
    );

    const ticket = result.rows[0];

    if (!ticket || !canAccessTicket(ticket, req.user)) {
      return res.status(404).json({
        message: "Ticket not found"
      });
    }

    const items = await pool.query(
      `SELECT * FROM ticket_line_items
       WHERE ticket_id = $1
       ORDER BY id`,
      [req.params.id]
    );

    return res.json({
      ...ticket,
      line_items: items.rows
    });
  } catch (error) {
    console.error("Ticket details:", error);
    return res.status(500).json({
      message: "Could not load ticket"
    });
  }
});

// POST /api/tickets
router.post("/", authenticateToken, async (req, res) => {
  const error = validateTicket(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const {
    ticket_number,
    title,
    template_name = "Field Service Ticket",
    customer_name,
    work_start_date = null,
    work_end_date = null,
    comments = ""
  } = req.body;

  const number = ticket_number ?? title;

  try {
    const result = await pool.query(
      `INSERT INTO tickets (
        ticket_number,
        template_name,
        customer_name,
        work_start_date,
        work_end_date,
        comments,
        status,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'Draft', $7, NOW(), NOW())
      RETURNING *`,
      [
        number.trim(),
        template_name.trim(),
        customer_name.trim(),
        work_start_date || null,
        work_end_date || null,
        typeof comments === "string" ? comments : "",
        req.user.id
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create ticket:", error);
    return res.status(500).json({
      message: "Could not create ticket"
    });
  }
});

// PUT /api/tickets/:id
router.put("/:id", authenticateToken, async (req, res) => {
  const error = validateTicket(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ticket = await findTicket(client, req.params.id);

    if (!ticket || !canAccessTicket(ticket, req.user)) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Ticket not found"
      });
    }

    if (
      req.user.role !== ADMIN &&
      !["Draft", "Rejected"].includes(ticket.status)
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Only Draft or Rejected tickets can be edited"
      });
    }

    const {
      ticket_number,
      title,
      template_name = "Field Service Ticket",
      customer_name,
      work_start_date = null,
      work_end_date = null,
      comments = ""
    } = req.body;

    const number = ticket_number ?? title;

    const result = await client.query(
      `UPDATE tickets SET
        ticket_number = $1,
        template_name = $2,
        customer_name = $3,
        work_start_date = $4,
        work_end_date = $5,
        comments = $6,
        updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        number.trim(),
        template_name.trim(),
        customer_name.trim(),
        work_start_date || null,
        work_end_date || null,
        typeof comments === "string" ? comments : "",
        req.params.id
      ]
    );

    await client.query("COMMIT");
    return res.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update ticket:", error);
    return res.status(500).json({
      message: "Could not update ticket"
    });
  } finally {
    client.release();
  }
});

// DELETE /api/tickets/:id
// Only Draft tickets can be deleted.
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM tickets
       WHERE id = $1
         AND status = 'Draft'
         AND ($2 = 'admin' OR created_by = $3)
       RETURNING id`,
      [req.params.id, req.user.role, req.user.id]
    );

    if (!result.rowCount) {
      return res.status(409).json({
        message: "Ticket not found or cannot be deleted"
      });
    }

    return res.json({
      message: "Draft ticket deleted"
    });
  } catch (error) {
    console.error("Delete ticket:", error);
    return res.status(500).json({
      message: "Could not delete ticket"
    });
  }
});

// PATCH /api/tickets/:id/status
router.patch("/:id/status", authenticateToken, async (req, res) => {
  const { action, comment = "" } = req.body || {};
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ticket = await findTicket(client, req.params.id);

    if (!ticket || !canAccessTicket(ticket, req.user)) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Ticket not found"
      });
    }

    const transitions = {
      submit: {
        from: ["Draft", "Rejected"],
        to: "Submitted",
        roles: [WORKER, ADMIN]
      },
      approve: {
        from: ["Submitted"],
        to: "Approved",
        roles: [ADMIN]
      },
      reject: {
        from: ["Submitted"],
        to: "Rejected",
        roles: [ADMIN]
      },
      invoice: {
        from: ["Approved"],
        to: "Invoiced",
        roles: [ADMIN]
      },
      void: {
        from: ["Draft", "Submitted", "Approved", "Rejected"],
        to: "Void",
        roles: [ADMIN]
      }
    };

    const rule = transitions[action];

    if (
      !rule ||
      !rule.roles.includes(req.user.role) ||
      !rule.from.includes(ticket.status)
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "This status transition is not permitted"
      });
    }

    if (
      action === "reject" &&
      (typeof comment !== "string" || !comment.trim())
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "A rejection reason is required"
      });
    }

    const updated = await client.query(
      `UPDATE tickets
       SET status = $1,
           rejection_reason = $2,
           reviewed_at = CASE
             WHEN $1 IN ('Approved', 'Rejected')
             THEN NOW()
             ELSE reviewed_at
           END,
           reviewed_by = CASE
             WHEN $1 IN ('Approved', 'Rejected')
             THEN $3
             ELSE reviewed_by
           END,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        rule.to,
        action === "reject" ? comment.trim() : ticket.rejection_reason,
        req.user.id,
        req.params.id
      ]
    );

    await client.query(
      `INSERT INTO ticket_status_history
       (ticket_id, old_status, new_status, changed_by, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.params.id,
        ticket.status,
        rule.to,
        req.user.id,
        typeof comment === "string" ? comment : ""
      ]
    );

    await client.query("COMMIT");
    return res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Change ticket status:", error);
    return res.status(500).json({
      message: "Could not change ticket status"
    });
  } finally {
    client.release();
  }
});

module.exports = router;
