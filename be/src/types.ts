import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export interface TokenCreatedEvent {
  mint: PublicKey;
  creator: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  timestamp: BN;
}

export interface TradeExecutedEvent {
  mint: PublicKey;
  trader: PublicKey;
  isBuy: boolean;
  solAmount: BN;
  tokenAmount: BN;
  fee: BN;
  timestamp: BN;
  virtualSolReserve: BN;
  virtualTokenReserve: BN;
}

export interface TokenGraduatedEvent {
  mint: PublicKey;
  solRaised: BN;
  timestamp: BN;
}