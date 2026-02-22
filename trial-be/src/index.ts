
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import tokensRouter from "./routes/tokens";
import { startListener } from "./listener";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Routes
app.route("/api/tokens", tokensRouter);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Start server
const PORT = parseInt(process.env.PORT || "3000");

console.log(`🚀 Server starting on port ${PORT}...`);

// Start Solana listener in background
startListener().catch(console.error);

// Start HTTP server
export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(`✅ Server running at http://localhost:${PORT}`);