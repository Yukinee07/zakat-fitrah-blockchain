require("dotenv").config();
const express    = require("express");
const helmet     = require("helmet");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");
const path       = require("path");
const fs         = require("fs");

const { connectDB }      = require("./config/db");
const { startListeners } = require("./services/eventListener");
const { startScheduler } = require("./services/scheduler");

const authRouter          = require("./routes/auth");
const usersRouter         = require("./routes/users");
const donationsRouter     = require("./routes/donations");
const beneficiariesRouter = require("./routes/beneficiaries");
const adminRouter         = require("./routes/admin");

// Ensure uploads directory exists.
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max:      200,
    standardHeaders: true,
    legacyHeaders:   false,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.use("/api/auth",          authRouter);
app.use("/api/users",         usersRouter);
app.use("/api/donations",     donationsRouter);
app.use("/api/beneficiaries", beneficiariesRouter);
app.use("/api/admin",         adminRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[UnhandledError]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.warn("[DB] MongoDB connection failed — running without persistence:", err.message);
  }

  // Only start blockchain services when a real contract address is configured.
  const contractAddr = process.env.CONTRACT_ADDRESS || "";
  const contractReady = /^0x[0-9a-fA-F]{40}$/.test(contractAddr);

  if (!contractReady) {
    console.warn(
      "[Server] CONTRACT_ADDRESS is not set or invalid — blockchain services disabled.\n" +
      "         Deploy the contract and update CONTRACT_ADDRESS in server/.env"
    );
  } else {
    try {
      await startListeners();
    } catch (err) {
      console.warn("[EventListener] Failed to start:", err.message);
    }

    try {
      startScheduler();
    } catch (err) {
      console.warn("[Scheduler] Failed to start:", err.message);
    }
  }

  app.listen(PORT, () => console.log(`[Server] Listening on http://localhost:${PORT}`));
})();
