import { Hono } from "hono";
import { db } from "../db";
import { tokens, trades } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";

const app = new Hono();

// GET /tokens — list all tokens
app.get("/", async (c) => {
  const sort = c.req.query("sort") || "latest";
  const limit = parseInt(c.req.query("limit") || "50");

  const result = await db
    .select()
    .from(tokens)
    .where(sort === "graduated" ? eq(tokens.isGraduated, true) : undefined)
    .orderBy(desc(tokens.createdAt))
    .limit(limit);

  const tokensWithPrice = result.map((token) => {
    const virtualSol = parseFloat(token.virtualSol);
    const virtualToken = parseFloat(token.virtualToken);
    const price = virtualSol / virtualToken;

    return {
      ...token,
      currentPrice: price,
      marketCap: price * parseFloat(token.totalSupply),
    };
  });

  return c.json({ tokens: tokensWithPrice });
});

// GET /tokens/:mint
app.get("/:mint", async (c) => {
  const mint = c.req.param("mint");

  const result = await db
    .select()
    .from(tokens)
    .where(eq(tokens.mint, mint))
    .limit(1);

  if (!result.length) {
    return c.json({ error: "Token not found" }, 404);
  }

  const token = result[0];
  const virtualSol = parseFloat(token.virtualSol);
  const virtualToken = parseFloat(token.virtualToken);
  const price = virtualSol / virtualToken;

  return c.json({
    token: {
      ...token,
      currentPrice: price,
      marketCap: price * parseFloat(token.totalSupply),
    },
  });
});

// GET /tokens/:mint/trades
app.get("/:mint/trades", async (c) => {
  const mint = c.req.param("mint");
  const limit = parseInt(c.req.query("limit") || "100");

  const result = await db
    .select()
    .from(trades)
    .where(eq(trades.mint, mint))
    .orderBy(desc(trades.timestamp))
    .limit(limit);

  return c.json({ trades: result });
});

// GET /tokens/search?q=<query>
app.get("/search", async (c) => {
  const q = c.req.query("q")?.toLowerCase();

  if (!q) {
    return c.json({ error: "Query required" }, 400);
  }

  const result = await db
    .select()
    .from(tokens)
    .where(
      sql`LOWER(${tokens.name}) LIKE ${"%" + q + "%"} OR LOWER(${tokens.symbol}) LIKE ${"%" + q + "%"}`
    )
    .limit(20);

  return c.json({ tokens: result });
});

export default app;