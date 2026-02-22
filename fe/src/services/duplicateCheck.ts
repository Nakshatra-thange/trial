// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE SOLUTION: Check Blockchain Directly for Duplicate Symbols
// ═══════════════════════════════════════════════════════════════════════════════

// src/services/duplicateCheck.ts

import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);
const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";

/**
 * Simple duplicate check: fetch all TokenMeta accounts and check symbols
 */
export async function isSymbolTaken(symbol: string): Promise<boolean> {
  const connection = new Connection(RPC_URL, "confirmed");
  const symbolUpper = symbol.toUpperCase();

  try {
    console.log("Checking if symbol exists:", symbolUpper);

    // Get ALL program accounts
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    
    console.log(`Found ${accounts.length} program accounts`);

    // Parse each account and check if it's a TokenMeta with matching symbol
    for (const { account, pubkey } of accounts) {
      try {
        const data = account.data;
        
        // TokenMeta accounts have specific structure:
        // 8 bytes: discriminator
        // 32 bytes: mint
        // 32 bytes: creator
        // Then variable length strings for name, symbol, etc.

        // Skip discriminator (8 bytes)
        let offset = 8;
        
        // Skip mint (32 bytes)
        offset += 32;
        
        // Skip creator (32 bytes)
        offset += 32;

        // Read name length and skip name
        if (offset + 4 > data.length) continue;
        const nameLen = data.readUInt32LE(offset);
        offset += 4;
        if (offset + nameLen > data.length) continue;
        offset += nameLen;

        // Read symbol length and symbol
        if (offset + 4 > data.length) continue;
        const symbolLen = data.readUInt32LE(offset);
        offset += 4;
        if (offset + symbolLen > data.length) continue;
        
        const existingSymbol = data.slice(offset, offset + symbolLen).toString("utf8");
        
        console.log(`  Found symbol: ${existingSymbol}`);

        if (existingSymbol.toUpperCase() === symbolUpper) {
          console.log(`  ✗ Symbol ${symbolUpper} already exists!`);
          return true; // DUPLICATE FOUND
        }
      } catch (err) {
        // Skip invalid accounts
        continue;
      }
    }

    console.log(`  ✓ Symbol ${symbolUpper} is available`);
    return false; // No duplicate
  } catch (err) {
    console.error("Error checking symbol:", err);
    return false; // Allow creation if check fails
  }
}

