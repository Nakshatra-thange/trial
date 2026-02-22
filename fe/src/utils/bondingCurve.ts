const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_DECIMALS = 1_000_000; // 6 decimals
const PLATFORM_FEE_BPS = 100; // 1%

/**
 * Calculate how many tokens user receives for given SOL input
 * Uses constant product formula: x * y = k
 */
export function calculateTokensOut(
  virtualSolReserve: number,  // in lamports
  virtualTokenReserve: number, // in base units
  solIn: number  // in lamports, AFTER fee deducted
): number {
  const k = virtualSolReserve * virtualTokenReserve;
  const newSolReserve = virtualSolReserve + solIn;
  const newTokenReserve = k / newSolReserve;
  const tokensOut = virtualTokenReserve - newTokenReserve;
  return tokensOut;
}

/**
 * Calculate how much SOL user receives for given token input
 */
export function calculateSolOut(
  virtualSolReserve: number,
  virtualTokenReserve: number,
  tokensIn: number  // in base units
): number {
  const k = virtualSolReserve * virtualTokenReserve;
  const newTokenReserve = virtualTokenReserve + tokensIn;
  const newSolReserve = k / newTokenReserve;
  const solOut = virtualSolReserve - newSolReserve;
  return solOut;
}

/**
 * Deduct 1% platform fee from SOL amount
 * Returns [amountAfterFee, feeAmount]
 */
export function deductFee(solAmount: number): [number, number] {
  const fee = Math.floor((solAmount * PLATFORM_FEE_BPS) / 10_000);
  const afterFee = solAmount - fee;
  return [afterFee, fee];
}

/**
 * Calculate current price per token in SOL
 */
export function calculatePrice(
  virtualSolReserve: number,
  virtualTokenReserve: number
): number {
  // Price = SOL reserve / token reserve
  const solInSol = virtualSolReserve / LAMPORTS_PER_SOL;
  const tokensInWhole = virtualTokenReserve / TOKEN_DECIMALS;
  return solInSol / tokensInWhole;
}

/**
 * Add slippage tolerance to minimum output
 * Default 1% slippage = user accepts up to 1% worse price
 */
export function applySlippage(amount: number, slippageBps: number = 100): number {
  return Math.floor(amount * (10_000 - slippageBps) / 10_000);
}
