// ─────────────────────────────────────────────────────────────────────────────
// programs/trial/src/curve.rs
//
// Pure math module — no Solana, no Anchor, no accounts.
// Just the bonding curve calculations.
// Test with: cargo test (runs instantly, no blockchain needed)
// ─────────────────────────────────────────────────────────────────────────────

/// Starting virtual reserves — same as pump.fun
/// These never reset, they only grow/shrink as trades happen
pub const INITIAL_VIRTUAL_SOL_RESERVE: u64   = 30_000_000_000;       // 30 SOL in lamports
pub const INITIAL_VIRTUAL_TOKEN_RESERVE: u64 = 1_073_000_000_000_000; // 1.073B tokens (6 decimals)
pub const INITIAL_REAL_TOKEN_RESERVE: u64    = 793_100_000_000_000;   // tokens available for sale
pub const GRADUATION_THRESHOLD: u64          = 85_000_000_000;        // 85 SOL in lamports
pub const PLATFORM_FEE_BPS: u64             = 100;                    // 100 bps = 1%
pub const BPS_DENOMINATOR: u64              = 10_000;

// ─── Core calculation functions ───────────────────────────────────────────────

/// Given SOL amount coming IN (after fee deducted),
/// returns how many tokens the buyer receives.
///
/// Formula: constant product  →  sol * token = k
///   new_sol_reserve   = virtual_sol + sol_in
///   new_token_reserve = k / new_sol_reserve
///   tokens_out        = virtual_token - new_token_reserve
pub fn calculate_tokens_out(
    virtual_sol_reserve: u64,
    virtual_token_reserve: u64,
    sol_in: u64,
) -> Option<u64> {
    if sol_in == 0 { return None; }

    // Use u128 to avoid overflow — reserves × reserves can exceed u64::MAX
    let sol_reserve   = virtual_sol_reserve as u128;
    let token_reserve = virtual_token_reserve as u128;
    let sol_amount    = sol_in as u128;

    // k = virtual_sol * virtual_token  (constant product)
    let k = sol_reserve.checked_mul(token_reserve)?;

    // new reserves after this trade
    let new_sol_reserve   = sol_reserve.checked_add(sol_amount)?;
    let new_token_reserve = k.checked_div(new_sol_reserve)?;

    // tokens buyer receives = how much token reserve shrank
    let tokens_out = token_reserve.checked_sub(new_token_reserve)?;

    // Downcast back to u64 — safe because tokens_out < token_reserve < u64::MAX
    Some(tokens_out as u64)
}

/// Given token amount coming IN (seller returning tokens),
/// returns how much SOL the seller receives (before fee).
///
/// Formula: constant product  →  sol * token = k
///   new_token_reserve = virtual_token + tokens_in
///   new_sol_reserve   = k / new_token_reserve
///   sol_out           = virtual_sol - new_sol_reserve
pub fn calculate_sol_out(
    virtual_sol_reserve: u64,
    virtual_token_reserve: u64,
    tokens_in: u64,
) -> Option<u64> {
    if tokens_in == 0 { return None; }

    let sol_reserve   = virtual_sol_reserve as u128;
    let token_reserve = virtual_token_reserve as u128;
    let token_amount  = tokens_in as u128;

    let k = sol_reserve.checked_mul(token_reserve)?;

    let new_token_reserve = token_reserve.checked_add(token_amount)?;
    let new_sol_reserve   = k.checked_div(new_token_reserve)?;

    let sol_out = sol_reserve.checked_sub(new_sol_reserve)?;

    Some(sol_out as u64)
}

/// Deduct platform fee from SOL amount.
/// Returns (sol_after_fee, fee_amount)
pub fn deduct_fee(sol_amount: u64) -> (u64, u64) {
    let fee = sol_amount
        .saturating_mul(PLATFORM_FEE_BPS)
        .saturating_div(BPS_DENOMINATOR);
    let after_fee = sol_amount.saturating_sub(fee);
    (after_fee, fee)
}

/// Current price of 1 token in SOL (as f64, for display only — never use f64 on-chain)
pub fn current_price_per_token(
    virtual_sol_reserve: u64,
    virtual_token_reserve: u64,
) -> f64 {
    // Price = SOL reserve / token reserve
    // Both in their base units (lamports and 6-decimal tokens)
    // Normalize: sol in SOL (÷1e9), tokens in whole tokens (÷1e6)
    let sol_reserve_sol     = virtual_sol_reserve as f64 / 1e9;
    let token_reserve_whole = virtual_token_reserve as f64 / 1e6;
    sol_reserve_sol / token_reserve_whole
}

/// Market cap in SOL at current price (for graduation progress display)
pub fn market_cap_sol(
    virtual_sol_reserve: u64,
    virtual_token_reserve: u64,
    total_supply: u64,
) -> f64 {
    let price = current_price_per_token(virtual_sol_reserve, virtual_token_reserve);
    let supply_whole = total_supply as f64 / 1e6;
    price * supply_whole
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────
// Run with: cargo test
// These run in milliseconds, no Solana needed.

#[cfg(test)]
mod tests {
    use super::*;

    // Helper: simulate a full buy with fee
    fn do_buy(
        vsr: u64,  // virtual sol reserve
        vtr: u64,  // virtual token reserve
        sol_spent: u64,
    ) -> (u64, u64, u64, u64) {
        // (tokens_out, sol_for_curve, fee, new_vsr, new_vtr) — returns 4
        let (sol_for_curve, fee) = deduct_fee(sol_spent);
        let tokens_out = calculate_tokens_out(vsr, vtr, sol_for_curve).unwrap();
        let new_vsr = vsr + sol_for_curve;
        let new_vtr = vtr - tokens_out;
        (tokens_out, new_vsr, new_vtr, fee)
    }

    // Helper: simulate a full sell with fee
    fn do_sell(
        vsr: u64,
        vtr: u64,
        tokens_in: u64,
    ) -> (u64, u64, u64, u64) {
        let sol_before_fee = calculate_sol_out(vsr, vtr, tokens_in).unwrap();
        let (sol_to_seller, fee) = deduct_fee(sol_before_fee);
        let new_vsr = vsr - sol_before_fee;
        let new_vtr = vtr + tokens_in;
        (sol_to_seller, new_vsr, new_vtr, fee)
    }

    // ─── 1. Basic sanity ──────────────────────────────────────────────────

    #[test]
    fn test_buy_returns_tokens() {
        let tokens = calculate_tokens_out(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
            1_000_000_000, // 1 SOL
        ).unwrap();

        assert!(tokens > 0, "buying 1 SOL should return tokens");
        println!("1 SOL buys {} tokens ({:.2} whole tokens)",
            tokens, tokens as f64 / 1e6);
    }

    #[test]
    fn test_sell_returns_sol() {
        let one_million_tokens = 1_000_000_000_000u64; // 1M tokens (6 decimals)
        let sol = calculate_sol_out(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
            one_million_tokens,
        ).unwrap();

        assert!(sol > 0, "selling tokens should return SOL");
        println!("selling 1M tokens returns {} lamports ({:.6} SOL)",
            sol, sol as f64 / 1e9);
    }

    // ─── 2. Price increases with each buy ─────────────────────────────────

    #[test]
    fn test_price_increases_after_each_buy() {
        let mut vsr = INITIAL_VIRTUAL_SOL_RESERVE;
        let mut vtr = INITIAL_VIRTUAL_TOKEN_RESERVE;
        let sol_each = 1_000_000_000u64; // 1 SOL each time

        let mut last_tokens_out = u64::MAX;

        for i in 0..10 {
            let (tokens_out, new_vsr, new_vtr, _fee) = do_buy(vsr, vtr, sol_each);

            // Same SOL should buy FEWER tokens each round (price going up)
            assert!(
                tokens_out < last_tokens_out,
                "buy {} : {} SOL should buy fewer tokens as price rises (got {})",
                i + 1, sol_each / 1_000_000_000, tokens_out
            );

            println!("Buy {}: 1 SOL → {} tokens, price = {:.8} SOL/token",
                i + 1,
                tokens_out / 1_000_000, // whole tokens
                current_price_per_token(new_vsr, new_vtr)
            );

            last_tokens_out = tokens_out;
            vsr = new_vsr;
            vtr = new_vtr;
        }
    }

    // ─── 3. Price decreases after sell ────────────────────────────────────

    #[test]
    fn test_price_decreases_after_sell() {
        // First buy some tokens
        let (tokens_out, vsr_after_buy, vtr_after_buy, _) = do_buy(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
            5_000_000_000, // 5 SOL
        );

        let price_after_buy = current_price_per_token(vsr_after_buy, vtr_after_buy);

        // Now sell half of them
        let (_, vsr_after_sell, vtr_after_sell, _) = do_sell(
            vsr_after_buy,
            vtr_after_buy,
            tokens_out / 2,
        );

        let price_after_sell = current_price_per_token(vsr_after_sell, vtr_after_sell);

        assert!(
            price_after_sell < price_after_buy,
            "price should drop after selling: before={:.8}, after={:.8}",
            price_after_buy, price_after_sell
        );

        println!("Price after buy:  {:.8} SOL/token", price_after_buy);
        println!("Price after sell: {:.8} SOL/token", price_after_sell);
    }

    // ─── 4. Buy then sell = you get back LESS (fee taken) ─────────────────

    #[test]
    fn test_buy_then_sell_costs_fee() {
        let sol_in = 1_000_000_000u64; // 1 SOL

        // Buy
        let (tokens_out, vsr2, vtr2, buy_fee) = do_buy(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
            sol_in,
        );

        // Immediately sell the same tokens
        let (sol_back, _vsr3, _vtr3, sell_fee) = do_sell(vsr2, vtr2, tokens_out);

        let total_fees = buy_fee + sell_fee;
        let loss       = sol_in - sol_back;

        assert!(
            sol_back < sol_in,
            "you should always get back less SOL than you spent (fees + slippage)"
        );

        println!("Spent:           {} lamports ({:.4} SOL)", sol_in, sol_in as f64 / 1e9);
        println!("Got back:        {} lamports ({:.4} SOL)", sol_back, sol_back as f64 / 1e9);
        println!("Total fees:      {} lamports ({:.4} SOL)", total_fees, total_fees as f64 / 1e9);
        println!("Total loss:      {} lamports ({:.4} SOL)", loss, loss as f64 / 1e9);
        println!("Loss as %:       {:.2}%", loss as f64 / sol_in as f64 * 100.0);
    }

    // ─── 5. Larger buy gets worse price (price impact) ────────────────────

    #[test]
    fn test_larger_buy_gets_worse_price_per_token() {
        let small_buy = 100_000_000u64;  // 0.1 SOL
        let large_buy = 10_000_000_000u64; // 10 SOL

        let small_tokens = calculate_tokens_out(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
            small_buy,
        ).unwrap();

        let large_tokens = calculate_tokens_out(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
            large_buy,
        ).unwrap();

        // Price per token = sol_spent / tokens_received
        let small_price = small_buy as f64 / small_tokens as f64;
        let large_price = large_buy as f64 / large_tokens as f64;

        assert!(
            large_price > small_price,
            "large buy should have worse price per token due to price impact"
        );

        println!("Small buy (0.1 SOL): {:.8} lamports/token", small_price);
        println!("Large buy (10 SOL):  {:.8} lamports/token", large_price);
        println!("Price impact: {:.2}x worse for large buy", large_price / small_price);
    }

    // ─── 6. Graduation triggers at 85 SOL ────────────────────────────────

    #[test]
    fn test_graduation_threshold() {
        let mut vsr        = INITIAL_VIRTUAL_SOL_RESERVE;
        let mut vtr        = INITIAL_VIRTUAL_TOKEN_RESERVE;
        let mut real_sol   = 0u64;
        let mut buy_count  = 0u32;

        // Keep buying 1 SOL at a time until graduation threshold
        while real_sol < GRADUATION_THRESHOLD {
            let sol_spent = 1_000_000_000u64; // 1 SOL
            let (sol_for_curve, _fee) = deduct_fee(sol_spent);
            let tokens = calculate_tokens_out(vsr, vtr, sol_for_curve).unwrap();

            vsr      += sol_for_curve;
            vtr      -= tokens;
            real_sol += sol_for_curve;
            buy_count += 1;

            if buy_count > 200 {
                panic!("took more than 200 buys — something is wrong with graduation math");
            }
        }

        assert!(real_sol >= GRADUATION_THRESHOLD, "should have hit graduation");
        println!("Graduated after {} buys of 1 SOL each", buy_count);
        println!("Final real SOL: {:.2} SOL", real_sol as f64 / 1e9);
        println!("Final price:    {:.8} SOL/token", current_price_per_token(vsr, vtr));
    }

    // ─── 7. Zero amounts are rejected ────────────────────────────────────

    #[test]
    fn test_zero_sol_buy_returns_none() {
        let result = calculate_tokens_out(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
            0,
        );
        assert!(result.is_none(), "zero SOL buy should return None");
    }

    #[test]
    fn test_zero_token_sell_returns_none() {
        let result = calculate_sol_out(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
            0,
        );
        assert!(result.is_none(), "zero token sell should return None");
    }

    // ─── 8. Overflow safety ───────────────────────────────────────────────

    #[test]
    fn test_no_overflow_on_large_amounts() {
        // Buy 50 SOL at once — large number, tests u128 overflow safety
        let result = calculate_tokens_out(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
            50_000_000_000, // 50 SOL
        );
        assert!(result.is_some(), "50 SOL buy should not overflow");
        println!("50 SOL buys {} whole tokens", result.unwrap() / 1_000_000);
    }

    // ─── 9. Constant product invariant holds ─────────────────────────────

    #[test]
    fn test_constant_product_invariant() {
        let vsr = INITIAL_VIRTUAL_SOL_RESERVE;
        let vtr = INITIAL_VIRTUAL_TOKEN_RESERVE;

        let k_before = vsr as u128 * vtr as u128;

        let sol_in = 2_000_000_000u64; // 2 SOL
        let (sol_for_curve, _) = deduct_fee(sol_in);
        let tokens_out = calculate_tokens_out(vsr, vtr, sol_for_curve).unwrap();

        let new_vsr = vsr + sol_for_curve;
        let new_vtr = vtr - tokens_out;
        let k_after = new_vsr as u128 * new_vtr as u128;

        // k_after should be >= k_before (it grows slightly due to integer division rounding)
        // It should NEVER be less than k_before
        assert!(
            k_after >= k_before,
            "constant product k should never decrease: before={}, after={}",
            k_before, k_after
        );

        let drift_pct = (k_after - k_before) as f64 / k_before as f64 * 100.0;
        println!("k before: {}", k_before);
        println!("k after:  {}", k_after);
        println!("k drift:  {:.6}% (should be near 0)", drift_pct);
    }

    // ─── 10. Price display ────────────────────────────────────────────────

    #[test]
    fn test_initial_price_display() {
        let price = current_price_per_token(
            INITIAL_VIRTUAL_SOL_RESERVE,
            INITIAL_VIRTUAL_TOKEN_RESERVE,
        );
        println!("Initial price: {:.10} SOL per token", price);
        println!("Initial price: {:.6} USD per token (at $150/SOL)",
            price * 150.0);

        // Should be a very small number (fractions of a cent at launch)
        assert!(price < 0.001, "initial price should be < 0.001 SOL");
        assert!(price > 0.0,   "initial price should be > 0");
    }
}