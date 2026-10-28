
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

// Route files
const authRoutes = require("./routes/authroutes");
const deviceRoutes = require("./routes/devices");
const inspectionRoutes = require("./routes/inspections");
const lineItemRoutes = require("./routes/lineitems");
const syncRoutes = require("./routes/sync");
const templateRoutes = require("./routes/templates");
const ticketRoutes = require("./routes/tickets");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Backend status
app.get("/", (req, res) => {
  res.json({
    message: "Legacy OFS Backend is running!"
  });
});

// Database health check
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    console.error("Database health check:", error.message);

    res.status(500).json({
      status: "error",
      database: "disconnected"
    });
  }
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/tickets", inspectionRoutes);
app.use("/api/tickets", lineItemRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/templates", templateRoutes);


// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "API route not found",
    path: req.originalUrl
  });
});

// General error handler
app.use((error, req, res, next) => {
  console.error("Unexpected error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Internal server error"
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Legacy OFS server running at http://localhost:${PORT}`);
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
