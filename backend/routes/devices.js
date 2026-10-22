const express = require("express");
const { randomUUID } = require("crypto");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, device_name, created_at, last_seen_at, revoked_at
       FROM user_devices
       WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Devices:", error.message);
    res.status(500).json({ message: "Could not load devices" });
  }
});

router.post("/register", authenticateToken, async (req, res) => {
  const { device_name, device_identifier } = req.body;

  if (
    typeof device_name !== "string" ||
    !device_name.trim() ||
    device_name.length > 100
  ) {
    return res.status(400).json({ message: "Invalid device name" });
  }

  const id = device_identifier || randomUUID();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialize device registrations for this user.
    await client.query(
      "SELECT id FROM users WHERE id=$1 FOR UPDATE",
      [req.user.id]
    );

    const existing = await client.query(
      `SELECT * FROM user_devices
       WHERE user_id=$1 AND device_identifier=$2
       FOR UPDATE`,
      [req.user.id, id]
    );

    if (existing.rows[0] && !existing.rows[0].revoked_at) {
      const updated = await client.query(
        `UPDATE user_devices SET device_name=$1, last_seen_at=NOW()
         WHERE id=$2 RETURNING *`,
        [device_name.trim(), existing.rows[0].id]
      );

      await client.query("COMMIT");
      return res.json(updated.rows[0]);
    }

    const count = await client.query(
      `SELECT COUNT(*)::int AS total FROM user_devices
       WHERE user_id=$1 AND revoked_at IS NULL`,
      [req.user.id]
    );

    if (count.rows[0].total >= 5) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Maximum five active devices allowed"
      });
    }

    const result = await client.query(
      `INSERT INTO user_devices
       (user_id, device_name, device_identifier)
       VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, device_name.trim(), id]
    );

    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Register device:", error.message);
    res.status(500).json({ message: "Could not register device" });
  } finally {
    client.release();
  }
});

// Admin can list a user's devices using a dedicated administrative endpoint.
router.get(
  "/admin/user/:userId",
  authenticateToken,
  requireRole("Administrator"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, user_id, device_name, created_at,
                last_seen_at, revoked_at
         FROM user_devices WHERE user_id=$1 ORDER BY created_at DESC`,
        [req.params.userId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Admin devices:", error.message);
      res.status(500).json({ message: "Could not load user devices" });
    }
  }
);

// Admin revokes a device.
router.delete(
  "/admin/:id",
  authenticateToken,
  requireRole("Administrator"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE user_devices SET revoked_at=NOW()
         WHERE id=$1 AND revoked_at IS NULL RETURNING id`,
        [req.params.id]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Active device not found"
        });
      }

      res.json({ message: "Device revoked" });
    } catch (error) {
      console.error("Revoke device:", error.message);
      res.status(500).json({ message: "Could not revoke device" });
    }
  }
);

module.exports = router;