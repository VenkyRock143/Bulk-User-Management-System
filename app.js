require("dotenv").config();

const express     = require("express");
const cors        = require("cors");
const helmet      = require("helmet");
const morgan      = require("morgan");
const compression = require("compression");

const connectDB    = require("./config/db");
const userRoutes   = require("./routes/userRoutes");
const errorHandler = require("./middleware/errorHandler");
const {
  standardLimiter,
  bulkLimiter,
  requireJson,
  requestTimer,
} = require("./middleware/requestMiddleware");

// ─── App Initialisation ───────────────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ──────────────────────────────────────────────────────

app.use(helmet());           // Sets secure HTTP headers
app.use(cors({
  origin:  process.env.ALLOWED_ORIGINS?.split(",") || "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Performance Middleware ───────────────────────────────────────────────────

app.use(compression()); // Gzip compress responses

// ─── Body Parsing ─────────────────────────────────────────────────────────────
//
// Large payload limit for bulk operations (5,000 users × ~500 bytes ≈ 2.5 MB)
// We allow 50 MB to handle 10,000 rich user objects comfortably.

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ─── Logging & Timing ─────────────────────────────────────────────────────────

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(requestTimer);

// ─── Rate Limiting ────────────────────────────────────────────────────────────

app.use("/api/users/bulk", bulkLimiter);   // Stricter limit for bulk ops
app.use("/api/",           standardLimiter);

// ─── JSON Content-Type Check ──────────────────────────────────────────────────

app.use("/api/", requireJson);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  const { connection } = require("mongoose");
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status:    "ok",
    timestamp: new Date().toISOString(),
    uptime:    process.uptime().toFixed(2) + "s",
    env:       process.env.NODE_ENV || "development",
    db: {
      status: dbStates[connection.readyState] || "unknown",
      name:   connection.name || null,
      host:   connection.host || null,
    },
    memory: {
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      rss:      `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use("/api/users", userRoutes);

// ─── API Info ─────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    name:        "Bulk User Management API",
    version:     "1.0.0",
    description: "Scalable bulk user operations with MongoDB",
    endpoints: {
      health:         "GET  /health",
      createUser:     "POST /api/users",
      bulkCreate:     "POST /api/users/bulk",
      bulkUpdate:     "PATCH /api/users/bulk",
      bulkDelete:     "DELETE /api/users/bulk",
      listUsers:      "GET  /api/users",
      getUser:        "GET  /api/users/:id",
      updateUser:     "PATCH /api/users/:id",
      deleteUser:     "DELETE /api/users/:id",
      stats:          "GET  /api/users/stats",
      exportJson:     "GET  /api/users/export?format=json",
      exportBson:     "GET  /api/users/export?format=bson",
      exportStats:    "GET  /api/users/export/stats",
    },
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log("\n🚀  ─────────────────────────────────────────────");
    console.log(`    Bulk User Management API`);
    console.log(`    http://localhost:${PORT}`);
    console.log(`    Environment : ${process.env.NODE_ENV || "development"}`);
    console.log("    ─────────────────────────────────────────────\n");
  });
};

startServer();

module.exports = app; // Export for testing