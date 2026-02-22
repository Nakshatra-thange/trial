import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN, EventParser, BorshCoder } from "@coral-xyz/anchor";
import { db } from "./db";
import { tokens, trades } from "./db/schema";
import { eq, sql } from "drizzle-orm";
import type { TokenCreatedEvent, TradeExecutedEvent, TokenGraduatedEvent } from "./types";
import idl from "../target/idl/smooth.json";

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_DECIMALS = 1_000_000;

export async function startListener() {
  console.log("🎧 Starting Solana event listener...");
  console.log("📡 Program ID:", PROGRAM_ID.toBase58());

  const connection = new Connection(process.env.SOLANA_RPC_URL!, {
    wsEndpoint: process.env.SOLANA_RPC_WS_URL,
    commitment: "confirmed",
  });

  // Anchor provider WITHOUT wallet (events only)
  const provider = new AnchorProvider(connection, {} as any, {
    commitment: "confirmed",
  });

  const program = new Program(idl as any, provider);

  // ✅ REAL FIX — Anchor Event Parser
  const coder = new BorshCoder(program.idl);
  const parser = new EventParser(PROGRAM_ID, coder);

  const subscriptionId = connection.onLogs(
    PROGRAM_ID,
    async ({ signature, logs, err }) => {
      if (err) {
        console.error("❌ Transaction error:", err);
        return;
      }

      console.log(`\n📦 New transaction: ${signature}`);

      try {
        // Parse Anchor events directly from logs
        const events = [...parser.parseLogs(logs || [])];

        if (!events.length) {
          console.log("ℹ️ No Anchor events detected");
          return;
        }

        for (const ev of events) {
          console.log("🎉 EVENT:", ev.name);
          await handleEvent(ev.name, ev.data, signature);
        }
      } catch (e) {
        console.error("❌ Event parsing failed:", e);
      }
    },
    "confirmed"
  );

  console.log("✅ Listener started, subscription ID:", subscriptionId);
}

// ─── Handle each event type ────────────────────────────────────────────────────
async function handleEvent(type: string, data: any, signature: string) {
  // Anchor events come in camelCase from IDL
  if (type === "tokenCreated") {
    await handleTokenCreated(data as TokenCreatedEvent);
  } else if (type === "tradeExecuted") {
    await handleTradeExecuted(data as TradeExecutedEvent, signature);
  } else if (type === "tokenGraduated") {
    await handleTokenGraduated(data as TokenGraduatedEvent);
  }
}

async function handleTokenCreated(event: TokenCreatedEvent) {
  console.log("🎉 TokenCreated:", event.name, `(${event.symbol})`);

  await db.insert(tokens).values({
    mint: event.mint.toBase58(),
    name: event.name,
    symbol: event.symbol,
    uri: event.uri,
    creator: event.creator.toBase58(),
    createdAt: new Date(Number(event.timestamp) * 1000),
    virtualSol: "30000000000",
    virtualToken: "1073000000000000",
  });

  console.log("✅ Token saved to DB");
}

async function handleTradeExecuted(event: TradeExecutedEvent, signature: string) {
  const action = event.isBuy ? "BUY" : "SELL";

  const solAmount = Number(event.solAmount) / LAMPORTS_PER_SOL;
  const tokenAmount = Number(event.tokenAmount) / TOKEN_DECIMALS;

  console.log(`💰 ${action}: ${solAmount.toFixed(4)} SOL ↔ ${tokenAmount.toFixed(2)} tokens`);

  const priceAtTrade = Number(event.solAmount) / Number(event.tokenAmount);

  await db.insert(trades).values({
    mint: event.mint.toBase58(),
    trader: event.trader.toBase58(),
    isBuy: event.isBuy,
    solAmount: event.solAmount.toString(),
    tokenAmount: event.tokenAmount.toString(),
    fee: event.fee.toString(),
    priceAtTrade: priceAtTrade.toString(),
    timestamp: new Date(Number(event.timestamp) * 1000),
    signature,
    virtualSolAfter: event.virtualSolReserve.toString(),
    virtualTokenAfter: event.virtualTokenReserve.toString(),
  });

  await db
    .update(tokens)
    .set({
      virtualSol: event.virtualSolReserve.toString(),
      virtualToken: event.virtualTokenReserve.toString(),
      totalSupply: sql`${tokens.totalSupply} ${
        event.isBuy ? sql`+` : sql`-`
      } ${event.tokenAmount.toString()}`,
    })
    .where(eq(tokens.mint, event.mint.toBase58()));

  console.log("✅ Trade saved to DB");
}

async function handleTokenGraduated(event: TokenGraduatedEvent) {
  console.log("🎓 Token graduated:", event.mint.toBase58());

  await db
    .update(tokens)
    .set({
      isGraduated: true,
      realSolBalance: event.solRaised.toString(),
    })
    .where(eq(tokens.mint, event.mint.toBase58()));

  console.log("✅ Token marked as graduated");
}