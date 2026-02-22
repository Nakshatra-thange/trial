import { Hono } from "hono";
import { db } from "../db";
import { tokens, trades } from "../db/schema";
import { eq, desc, sql, like, and } from "drizzle-orm";

const app = new Hono();

// GET /tokens — list all tokens
app.get("/", async (c) => {
    const sort = c.req.query("sort") || "latest";
    const limit = parseInt(c.req.query("limit") || "50");
  
    const baseQuery = db.select().from(tokens);
  
    let result;
    if (sort === "graduated") {
      result = await baseQuery
      .where(
        and(
          eq(tokens.hidden, false),
          eq(tokens.archived, false),
          eq(tokens.creatorHidden, false)
        )
      )
        .orderBy(desc(tokens.createdAt))
        .limit(limit);
  
    } else if (sort === "trending") {
      
      result = await baseQuery
        .orderBy(desc(tokens.realSolBalance))
        .limit(limit);
  
    } else {
      // latest
      result = await baseQuery
        .orderBy(desc(tokens.createdAt))
        .limit(limit);
    }
  
    const tokensWithPrice = result.map((token) => {
      const virtualSol = parseFloat(token.virtualSol);
      const virtualToken = parseFloat(token.virtualToken);
      const price = virtualSol / virtualToken;
      const supply = parseFloat(token.totalSupply) / 1e6;
      return {
        ...token,
        currentPrice: price,
        marketCap: price * supply,
      };
    });
  
    return c.json({ tokens: tokensWithPrice });
  });

// GET /tokens/search?q=<query> — search by name or symbol
app.get("/search", async (c) => {
  const q = c.req.query("q")?.toLowerCase();

  if (!q) {
    return c.json({ error: "Query parameter 'q' required" }, 400);
  }

  const result = await db
    .select()
    .from(tokens)
    .where(
      sql`LOWER(${tokens.name}) LIKE ${`%${q}%`} OR LOWER(${tokens.symbol}) LIKE ${`%${q}%`}`
    )
    .limit(20);

  return c.json({ tokens: result });
});

app.get("/admin/all", async (c) => {
  const result = await db
    .select()
    .from(tokens)
    .orderBy(desc(tokens.createdAt));

  return c.json({ tokens: result });
});


// GET /tokens/:mint — single token details
app.get("/:mint", async (c) => {
  const mint = c.req.param("mint");

  const token = await db.select().from(tokens).where(
    and(
      eq(tokens.mint, mint),
      eq(tokens.hidden, false),
      eq(tokens.creatorHidden, false),
      eq(tokens.archived, false)
    )
  )

  if (!token.length) {
    return c.json({ error: "Token not found" }, 404);
  }

  const tokenData = token[0]!;

  // Calculate current price
  const virtualSol = parseFloat(tokenData.virtualSol);
  const virtualToken = parseFloat(tokenData.virtualToken);
  const price = virtualSol / virtualToken;
  const supply = parseFloat(tokenData.totalSupply) / 1e6;

  return c.json({
    token: {
      ...tokenData,
      currentPrice: price,
      marketCap: price * supply,
    },
  });
});

// GET /tokens/:mint/trades — trade history for charts
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

app.get("/check-symbol/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();

  const existing = await db
    .select()
    .from(tokens)
    .where(eq(tokens.symbol, symbol))
    .limit(1);

  return c.json({
    exists: existing.length > 0,
    symbol,
  });
});



app.post("/hide/:mint", async (c) => {
  const adminKey = c.req.header("x-admin-key");

  if (adminKey !== process.env.ADMIN_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const mint = c.req.param("mint");
  const { reason } = await c.req.json();

  await db.update(tokens).set({
    hidden: true,
    hiddenReason: reason || "duplicate",
  }).where(eq(tokens.mint, mint));

  return c.json({ success: true });
});

// POST /api/tokens/unhide/:mint
app.post("/unhide/:mint", async (c) => {
  const mint = c.req.param("mint");

  await db
    .update(tokens)
    .set({
      hidden: false,
      hiddenReason: null,
    })
    .where(eq(tokens.mint, mint));

  return c.json({ success: true });
});
app.post("/creator/hide/:mint", async (c) => {
  const mint = c.req.param("mint");

  await db
    .update(tokens)
    .set({ creatorHidden: true })
    .where(eq(tokens.mint, mint));

  return c.json({ success: true });
});
app.post("/creator/archive/:mint", async (c) => {
  const mint = c.req.param("mint");

  await db
    .update(tokens)
    .set({ archived: true })
    .where(eq(tokens.mint, mint));

  return c.json({ success: true });
});



export default app;