import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import tokensRouter from "./routes/tokens";
import { startListener } from "./listener";
import ipfsRoutes from "./routes/ipfs"
const app = new Hono();
import { config } from "dotenv";
config(); // must be at the very top before anything else
// Middleware
app.use("*", cors());
app.use("*", logger());

// Routes
app.route("/api/tokens", tokensRouter);
app.route("/api/ipfs", ipfsRoutes);
// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Start server
const PORT = parseInt(process.env.PORT || "3000");

console.log(`🚀 Server starting on port ${PORT}...`);
console.log("JWT loaded:", !!process.env.PINATA_JWT);
// Start Solana listener in background
startListener().catch(console.error);

// Start HTTP server
export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(`✅ Server running at http://localhost:${PORT}`);