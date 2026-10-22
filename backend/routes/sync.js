const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

router.post("/", authenticateToken, async (req, res) => {
  const { operations } = req.body;

  if (!Array.isArray(operations) || operations.length > 50) {
    return res.status(400).json({
      message: "Provide a list of at most 50 operations"
    });
  }

  const results = [];

  for (const operation of operations) {
    const {
      operation_id,
      type,
      payload
    } = operation || {};

    if (
      typeof operation_id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(operation_id) ||
      type !== "create_ticket" ||
      !payload ||
      typeof payload !== "object"
    ) {
      results.push({
        operation_id: operation_id || null,
        status: "rejected",
        message: "Invalid operation"
      });
      continue;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const previous = await client.query(
        `SELECT result FROM offline_sync_operations
         WHERE user_id=$1 AND operation_id=$2 FOR UPDATE`,
        [req.user.id, operation_id]
      );

      if (previous.rowCount) {
        await client.query("COMMIT");

        results.push({
          operation_id,
          status: "synced",
          result: previous.rows[0].result
        });

        continue;
      }

      const title = payload.title;
      const description = payload.description || "";
      const customer = payload.customer_name || "";

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.length > 200
      ) {
        await client.query("ROLLBACK");

        results.push({
          operation_id,
          status: "rejected",
          message: "A valid title is required"
        });

        continue;
      }

      const inserted = await client.query(
        `INSERT INTO tickets
         (title, description, customer_name, status, created_by,
          created_at, updated_at)
         VALUES ($1,$2,$3,'Draft',$4,NOW(),NOW())
         RETURNING id, title, status`,
        [title.trim(), description, customer, req.user.id]
      );

      const ticket = inserted.rows[0];

      await client.query(
        `INSERT INTO offline_sync_operations
         (user_id, operation_id, result)
         VALUES ($1,$2,$3)`,
        [req.user.id, operation_id, JSON.stringify(ticket)]
      );

      await client.query("COMMIT");

      results.push({
        operation_id,
        status: "synced",
        result: ticket
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Offline sync:", error.message);

      results.push({
        operation_id,
        status: "retry",
        message: "Temporary sync failure"
      });
    } finally {
      client.release();
    }
  }

  res.json({ results });
});

module.exports = router;