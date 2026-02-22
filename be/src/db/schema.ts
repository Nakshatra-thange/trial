import { pgTable, uuid, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";

export const tokens = pgTable("tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  mint: text("mint").notNull().unique(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  uri: text("uri").notNull(),
  description: text("description"),
  creator: text("creator").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isGraduated: boolean("is_graduated").notNull().default(false),
  realSolBalance: numeric("real_sol_balance").notNull().default("0"),
  totalSupply: numeric("total_supply").notNull().default("0"),
  virtualSol: numeric("virtual_sol").notNull(),
  virtualToken: numeric("virtual_token").notNull(),
});

export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  mint: text("mint").notNull().references(() => tokens.mint),
  trader: text("trader").notNull(),
  isBuy: boolean("is_buy").notNull(),
  solAmount: numeric("sol_amount").notNull(),
  tokenAmount: numeric("token_amount").notNull(),
  fee: numeric("fee").notNull(),
  priceAtTrade: numeric("price_at_trade").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  signature: text("signature").unique(),
  virtualSolAfter: numeric("virtual_sol_after").notNull(),
  virtualTokenAfter: numeric("virtual_token_after").notNull(),
});