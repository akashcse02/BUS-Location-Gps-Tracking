import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import dbRoutes from "./routes/db.js";
import issuesRoutes from "./routes/issues.js";
import { attachUser } from "./middleware/auth.js";
import trackingRoutes from "./routes/tracking.js";
import deviceRoutes from "./routes/device.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const required = ["MONGODB_URI", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(
    `Missing required environment variable(s): ${missing.join(", ")}.\n` +
      "Create backend/.env (see backend/.env.example) and fill in real values before starting the server."
  );
  process.exit(1);
}

const app = express();

// Allow the frontend from ANY origin (localhost, 127.0.0.1, LAN IP, deployed URL).
// We authenticate with a Bearer token (not cookies), so this is safe and it
// removes the most common cause of "Failed to fetch" in the browser.
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Health check works even when MongoDB is down, and reports DB status.
app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.json({ ok: true, db: connected ? "connected" : "disconnected" });
});

// If MongoDB isn't connected yet, answer with a clear JSON error instead of
// hanging or crashing (the frontend shows this message to the user).
function requireDb(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();
  const message =
    "Database is not connected. Check MONGODB_URI in backend/.env and that MongoDB is running, then look at the backend terminal for details.";
  res.status(503).json({ message, data: null, error: { message } });
}

app.use(attachUser);
app.use("/api/auth", requireDb, authRoutes);
app.use("/api/db", requireDb, dbRoutes);
app.use("/api/issues", requireDb, issuesRoutes);
app.use("/api/tracking", requireDb, trackingRoutes);
app.use("/api/device", requireDb, deviceRoutes);
app.use("/api/admin", requireDb, adminRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ message: `No such API route: ${req.method} ${req.originalUrl}` });
});

// Centralized error handler (kept last).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;

// Start the HTTP server right away so the frontend can always reach it,
// then keep trying to connect to MongoDB until it works.
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

async function connectToMongo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error(`Failed to connect to MongoDB: ${err.message}`);
    console.error("Retrying in 5 seconds... (check MONGODB_URI in backend/.env)");
    setTimeout(connectToMongo, 5000);
  }
}
connectToMongo();

mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
mongoose.connection.on("reconnected", () => console.log("MongoDB reconnected"));
