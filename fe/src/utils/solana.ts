import { PublicKey } from '@solana/web3.js';

/**
 * Truncate a Solana address for display
 * @param address - Full address string
 * @param chars - Number of characters to show on each end (default 4)
 * @returns Truncated address like "9HgX...Km8P"
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Truncate a transaction signature
 */
export function truncateSignature(signature: string, chars: number = 8): string {
  if (!signature) return '';
  if (signature.length <= chars * 2) return signature;
  return `${signature.slice(0, chars)}...${signature.slice(-chars)}`;
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / 1_000_000_000;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}

/**
 * Format SOL amount with decimals
 */
export function formatSol(amount: number, decimals: number = 4): string {
  return amount.toFixed(decimals);
}

/**
 * Get Solana Explorer transaction URL
 */
export function getExplorerTxUrl(signature: string, cluster: string = 'devnet'): string {
  const baseUrl = 'https://explorer.solana.com/tx';
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `${baseUrl}/${signature}${clusterParam}`;
}

/**
 * Get Solana Explorer address URL
 */
export function getExplorerAddressUrl(address: string, cluster: string = 'devnet'): string {
  const baseUrl = 'https://explorer.solana.com/address';
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `${baseUrl}/${address}${clusterParam}`;
}

/**
 * Validate if string is a valid Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}