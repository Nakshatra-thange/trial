
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { tokens, trades } from "./db/schema";
import { eq } from "drizzle-orm";
import type { TokenCreatedEvent, TradeExecutedEvent, TokenGraduatedEvent } from "./types";
import idl from "./target/idl/smooth.json";

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_DECIMALS = 1_000_000; // 6 decimals

export async function startListener() {
  console.log("🎧 Starting Solana event listener...");
  console.log("📡 Program ID:", PROGRAM_ID.toBase58());

  const connection = new Connection(process.env.SOLANA_RPC_URL!, {
    wsEndpoint: process.env.SOLANA_RPC_WS_URL,
    commitment: "confirmed",
  });

  // Create a dummy wallet for program instantiation (not used for signing)
  const dummyWallet = new Wallet({
    publicKey: PROGRAM_ID,
    signTransaction: async () => { throw new Error("Not implemented"); },
    signAllTransactions: async () => { throw new Error("Not implemented"); },
  });

  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: "confirmed",
  });

  const program = new Program(idl as any, provider);

  // Subscribe to all transactions involving your program
  const subscriptionId = connection.onLogs(
    PROGRAM_ID,
    async ({ signature, logs, err }) => {
      if (err) {
        console.error("❌ Transaction error:", err);
        return;
      }

      console.log(`\n📦 New transaction: ${signature}`);

      try {
        // Fetch full transaction to get event data
        const tx = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });

        if (!tx) {
          console.log("⚠️ Transaction not found");
          return;
        }

        // Parse events from logs
        const events = parseEvents(logs, program);

        for (const event of events) {
          await handleEvent(event, signature);
        }
      } catch (err) {
        console.error("Error processing transaction:", err);
      }
    },
    "confirmed"
  );

  console.log("✅ Listener started, subscription ID:", subscriptionId);
}

// ─── Parse events from transaction logs ───────────────────────────────────────
function parseEvents(logs: string[], program: Program): any[] {
  const events: any[] = [];

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Anchor emits events like: "Program data: <base64>"
    if (log.startsWith("Program data: ")) {
      const base64Data = log.slice("Program data: ".length);
      const buffer = Buffer.from(base64Data, "base64");

      // First 8 bytes are the discriminator (event type hash)
      const discriminator = buffer.slice(0, 8);

      // Decode based on discriminator
      // You need to match these to your program's event discriminators
      // For now we'll parse manually — in production use Anchor's event parser

      // TokenCreated event
      if (isTokenCreatedEvent(discriminator, logs[i - 1])) {
        events.push({
          type: "TokenCreated",
          data: parseTokenCreatedEvent(buffer.slice(8)),
        });
      }

      // TradeExecuted event
      if (isTradeExecutedEvent(discriminator, logs[i - 1])) {
        events.push({
          type: "TradeExecuted",
          data: parseTradeExecutedEvent(buffer.slice(8)),
        });
      }

      // TokenGraduated event
      if (isTokenGraduatedEvent(discriminator, logs[i - 1])) {
        events.push({
          type: "TokenGraduated",
          data: parseTokenGraduatedEvent(buffer.slice(8)),
        });
      }
    }
  }

  return events;
}

// Event type detection helpers
function isTokenCreatedEvent(disc: Buffer, prevLog: string): boolean {
  return prevLog?.includes("TokenCreated") ?? false;
}

function isTradeExecutedEvent(disc: Buffer, prevLog: string): boolean {
  return prevLog?.includes("TradeExecuted") ?? false;
}

function isTokenGraduatedEvent(disc: Buffer, prevLog: string): boolean {
  return prevLog?.includes("TokenGraduated") ?? false;
}

// Manual event parsing (simplified — in production use Anchor's borsh deserializer)
function parseTokenCreatedEvent(data: Buffer): TokenCreatedEvent {
  let offset = 0;

  const mint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const creator = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const nameLen = data.readUInt32LE(offset);
  offset += 4;
  const name = data.slice(offset, offset + nameLen).toString("utf8");
  offset += nameLen;

  const symbolLen = data.readUInt32LE(offset);
  offset += 4;
  const symbol = data.slice(offset, offset + symbolLen).toString("utf8");
  offset += symbolLen;

  const uriLen = data.readUInt32LE(offset);
  offset += 4;
  const uri = data.slice(offset, offset + uriLen).toString("utf8");
  offset += uriLen;

  const timestamp = new BN(data.slice(offset, offset + 8), "le");

  return { mint, creator, name, symbol, uri, timestamp };
}

function parseTradeExecutedEvent(data: Buffer): TradeExecutedEvent {
  let offset = 0;

  const mint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const trader = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const isBuy = data.readUInt8(offset) === 1;
  offset += 1;

  const solAmount = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const tokenAmount = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const fee = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const timestamp = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const virtualSolReserve = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const virtualTokenReserve = new BN(data.slice(offset, offset + 8), "le");

  return {
    mint,
    trader,
    isBuy,
    solAmount,
    tokenAmount,
    fee,
    timestamp,
    virtualSolReserve,
    virtualTokenReserve,
  };
}

function parseTokenGraduatedEvent(data: Buffer): TokenGraduatedEvent {
  let offset = 0;

  const mint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const solRaised = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const timestamp = new BN(data.slice(offset, offset + 8), "le");

  return { mint, solRaised, timestamp };
}

// ─── Handle each event type ────────────────────────────────────────────────────
async function handleEvent(event: any, signature: string) {
  if (event.type === "TokenCreated") {
    await handleTokenCreated(event.data);
  } else if (event.type === "TradeExecuted") {
    await handleTradeExecuted(event.data, signature);
  } else if (event.type === "TokenGraduated") {
    await handleTokenGraduated(event.data);
  }
}

async function handleTokenCreated(event: TokenCreatedEvent) {
  console.log("🪙 TokenCreated:", event.name, `(${event.symbol})`);

  await db.insert(tokens).values({
    mint: event.mint.toBase58(),
    name: event.name,
    symbol: event.symbol,
    uri: event.uri,
    creator: event.creator.toBase58(),
    createdAt: new Date(event.timestamp.toNumber() * 1000),
    virtualSol: "30000000000", // 30 SOL in lamports
    virtualToken: "1073000000000000", // 1.073B tokens
  });

  console.log("✅ Token saved to DB");
}

async function handleTradeExecuted(event: TradeExecutedEvent, signature: string) {
  const action = event.isBuy ? "BUY" : "SELL";
  const solAmount = event.solAmount.toNumber() / LAMPORTS_PER_SOL;
  const tokenAmount = event.tokenAmount.toNumber() / TOKEN_DECIMALS;

  console.log(`💰 ${action}: ${solAmount.toFixed(4)} SOL ↔ ${tokenAmount.toFixed(2)} tokens`);

  const priceAtTrade = event.solAmount.toNumber() / event.tokenAmount.toNumber();

  // Insert trade
  await db.insert(trades).values({
    mint: event.mint.toBase58(),
    trader: event.trader.toBase58(),
    isBuy: event.isBuy,
    solAmount: event.solAmount.toString(),
    tokenAmount: event.tokenAmount.toString(),
    fee: event.fee.toString(),
    priceAtTrade: priceAtTrade.toString(),
    timestamp: new Date(event.timestamp.toNumber() * 1000),
    signature,
    virtualSolAfter: event.virtualSolReserve.toString(),
    virtualTokenAfter: event.virtualTokenReserve.toString(),
  });

  // Update token's current price and supply
  await db
  .update(tokens)
  .set({
    virtualSol: event.virtualSolReserve.toString(),
    virtualToken: event.virtualTokenReserve.toString(),
    // Use SQL expression for increment/decrement
    totalSupply: event.isBuy
      ? sql`${tokens.totalSupply} + ${event.tokenAmount.toString()}`
      : sql`${tokens.totalSupply} - ${event.tokenAmount.toString()}`,
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

