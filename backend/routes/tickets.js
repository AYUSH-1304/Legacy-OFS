const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

const VALID_STATUSES = [
  "Draft",
  "Submitted",
  "Approved",
  "Rejected",
  "Invoiced",
  "Void"
];

const ADMIN = "Administrator";
const WORKER = "Field Worker";

function validateTicket(body) {
  if (!body.title || typeof body.title !== "string") {
    return "A ticket title is required";
  }

  if (body.title.trim().length > 200) {
    return "Title cannot exceed 200 characters";
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

async function findTicket(client, id, user) {
  const result = await client.query(
    `SELECT * FROM tickets
     WHERE id = $1
     AND ($2 = $3 OR created_by = $4)`,
    [id, ADMIN, user.role, user.id]
  );

  return result.rows[0];
}

// List tickets. Admin can see all; worker sees own tickets.
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
        return res.status(400).json({ message: "Invalid status" });
      }

      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (search) {
      params.push(`%${String(search).slice(0, 100)}%`);
      conditions.push(
        `(title ILIKE $${params.length} OR customer_name ILIKE $${params.length})`
      );
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT * FROM tickets ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error("List tickets:", error.message);
    res.status(500).json({ message: "Could not load tickets" });
  }
});

// Ticket details
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM tickets WHERE id = $1
       AND ($2 = $3 OR created_by = $4)`,
      [req.params.id, ADMIN, req.user.role, req.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const items = await pool.query(
      `SELECT * FROM ticket_line_items
       WHERE ticket_id = $1 ORDER BY id`,
      [req.params.id]
    );

    res.json({ ...result.rows[0], line_items: items.rows });
  } catch (error) {
    console.error("Ticket details:", error.message);
    res.status(500).json({ message: "Could not load ticket" });
  }
});

// Create ticket
router.post("/", authenticateToken, async (req, res) => {
  const error = validateTicket(req.body);
  if (error) return res.status(400).json({ message: error });

  const {
    title,
    description = "",
    customer_name = "",
    work_start_date = null,
    work_end_date = null,
    comments = ""
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO tickets
       (title, description, customer_name, work_start_date,
        work_end_date, comments, status, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'Draft',$7,NOW(),NOW())
       RETURNING *`,
      [
        title.trim(),
        description,
        customer_name,
        work_start_date,
        work_end_date,
        comments,
        req.user.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create ticket:", error.message);
    res.status(500).json({ message: "Could not create ticket" });
  }
});

// Edit only draft/rejected tickets owned by worker, or any editable ticket by admin.
router.put("/:id", authenticateToken, async (req, res) => {
  const error = validateTicket(req.body);
  if (error) return res.status(400).json({ message: error });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ticket = await findTicket(client, req.params.id, req.user);

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (
      ![ "Draft", "Rejected" ].includes(ticket.status) &&
      req.user.role !== ADMIN
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Only Draft or Rejected tickets can be edited"
      });
    }

    const {
      title,
      description = "",
      customer_name = "",
      work_start_date = null,
      work_end_date = null,
      comments = ""
    } = req.body;

    const updated = await client.query(
      `UPDATE tickets SET
        title=$1, description=$2, customer_name=$3,
        work_start_date=$4, work_end_date=$5,
        comments=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [
        title.trim(), description, customer_name,
        work_start_date, work_end_date, comments,
        req.params.id
      ]
    );

    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update ticket:", error.message);
    res.status(500).json({ message: "Could not update ticket" });
  } finally {
    client.release();
  }
});

// Delete only a Draft ticket. Admin may delete only Draft tickets too.
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM tickets
       WHERE id=$1 AND status='Draft'
       AND ($2=$3 OR created_by=$4)
       RETURNING id`,
      [req.params.id, ADMIN, req.user.role, req.user.id]
    );

    if (!result.rowCount) {
      return res.status(409).json({
        message: "Ticket not found or cannot be deleted in its current state"
      });
    }

    res.json({ message: "Draft ticket deleted" });
  } catch (error) {
    console.error("Delete ticket:", error.message);
    res.status(500).json({ message: "Could not delete ticket" });
  }
});

// Change status with server-side transition and role checks.
router.patch(
  "/:id/status",
  authenticateToken,
  async (req, res) => {
    const { action, comment = "" } = req.body;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const found = await client.query(
        "SELECT * FROM tickets WHERE id=$1 FOR UPDATE",
        [req.params.id]
      );

      const ticket = found.rows[0];

      if (
        !ticket ||
        (req.user.role !== ADMIN &&
          String(ticket.created_by) !== String(req.user.id))
      ) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Ticket not found" });
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

      if (action === "reject" && !comment.trim()) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "A rejection reason is required"
        });
      }

      const updated = await client.query(
        `UPDATE tickets SET status=$1, updated_at=NOW()
         WHERE id=$2 RETURNING *`,
        [rule.to, req.params.id]
      );

      await client.query(
        `INSERT INTO ticket_status_history
         (ticket_id, old_status, new_status, changed_by, comment)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, ticket.status, rule.to, req.user.id, comment]
      );

      await client.query("COMMIT");
      res.json(updated.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Change ticket status:", error.message);
      res.status(500).json({ message: "Could not change ticket status" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;