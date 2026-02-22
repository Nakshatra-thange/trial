pub mod curve;
pub use curve::*;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Transfer};
use anchor_spl::associated_token::AssociatedToken;


declare_id!("6gvL3BnHHw3a3HoQpmhcbuuVV2tHgnaUBcFjy3Tye55y");

pub const PLATFORM_FEE_BPS: u64 = 100;
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const GRADUATION_THRESHOLD_LAMPORTS: u64 = 85 * 1_000_000_000; //85 sol
pub const INITIAL_VIRTUAL_SOL_RESERVE: u64 = 30 * 1_000_000_000; // 30 SOL
pub const INITIAL_VIRTUAL_TOKEN_RESERVE: u64 = 1_073_000_000_000_000; // 1.073B tokens (6 decimals)
pub const INITIAL_REAL_TOKEN_RESERVE: u64 = 793_100_000_000_000;
pub const TOKEN_DECIMALS: u8 = 6; //6 decimal places
pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_URI_LEN: usize = 200;

#[program]
pub mod smooth {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        fee_bps: u64,
        graduation_threshold: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.platform_config;

        config.admin = ctx.accounts.admin.key();
        config.fee_bps = fee_bps;
        config.fee_wallet = ctx.accounts.fee_wallet.key();
        config.grad_threshold = graduation_threshold;
        config.total_tokens = 0;
        config.bump = ctx.bumps.platform_config;

        emit!(PlatformInitialized {
            admin: config.admin,
            fee_bps,
            grad_threshold: graduation_threshold,
        });

        Ok(())
    }

    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        uri: String,
        description: String,
    ) -> Result<()> {
        require!(name.len() > 0 && name.len() <= MAX_NAME_LEN, ErrorCode::InvalidName);
        require!(symbol.len() > 0 && symbol.len() <= MAX_SYMBOL_LEN, ErrorCode::InvalidSymbol);
        require!(uri.len() > 0 && uri.len() <= MAX_URI_LEN, ErrorCode::InvalidUri);

        let clock = Clock::get()?;

        // Initialize token meta
        let meta = &mut ctx.accounts.token_meta;
        meta.mint = ctx.accounts.mint.key();
        meta.creator = ctx.accounts.creator.key();
        meta.name = name.clone();
        meta.uri = uri.clone();
        meta.symbol = symbol.clone();
        meta.description = description;
        meta.created_at = clock.unix_timestamp;
        meta.bump = ctx.bumps.token_meta;

        // Initialize bonding curve
        let curve = &mut ctx.accounts.bonding_curve;
        curve.mint = ctx.accounts.mint.key();
        curve.creator = ctx.accounts.creator.key();
        curve.virtual_sol_reserve = INITIAL_VIRTUAL_SOL_RESERVE;
        curve.virtual_token_reserve = INITIAL_VIRTUAL_TOKEN_RESERVE;
        curve.real_sol_balance = 0;
        curve.real_token_reserve = INITIAL_REAL_TOKEN_RESERVE;
        curve.token_total_supply = 0;
        curve.is_graduated = false;
        curve.bump = ctx.bumps.bonding_curve;

        // Mint initial token supply into bonding curve token account
        // Store the mint key in a variable to extend its lifetime
let mint_key = ctx.accounts.mint.key();
let mint_seeds: &[&[&[u8]]] = &[&[
    b"bonding_curve",  
    mint_key.as_ref(),
    &[curve.bump],    
]];

token::mint_to(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.bonding_curve_token_account.to_account_info(),
            authority: ctx.accounts.bonding_curve.to_account_info(),
        },
        mint_seeds,
    ),
    INITIAL_REAL_TOKEN_RESERVE,
)?;

        ctx.accounts.platform_config.total_tokens += 1;

        emit!(TokenCreated {
            mint: ctx.accounts.mint.key(),
            creator: ctx.accounts.creator.key(),
            name,
            symbol,
            uri,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn buy(
        ctx: Context<Buy>,
        sol_amount: u64,
        min_tokens_out: u64,
    ) -> Result<()> {
        let curve = &ctx.accounts.bonding_curve;
        require!(!curve.is_graduated, ErrorCode::TokenGraduated);
        require!(sol_amount > 0, ErrorCode::ZeroAmount);

        let fee_lamports = sol_amount
            .checked_mul(ctx.accounts.platform_config.fee_bps)
            .unwrap()
            .checked_div(BPS_DENOMINATOR)
            .unwrap();

        let sol_for_curve = sol_amount.checked_sub(fee_lamports).unwrap();

        let tokens_out = {
            let curve = &ctx.accounts.bonding_curve;
            let new_sol_reserve = curve
                .virtual_sol_reserve
                .checked_add(sol_for_curve)
                .unwrap();
            let k = (curve.virtual_sol_reserve as u128)
                .checked_mul(curve.virtual_token_reserve as u128)
                .unwrap();
            let new_token_reserve = k.checked_div(new_sol_reserve as u128).unwrap() as u64;
            curve
                .virtual_token_reserve
                .checked_sub(new_token_reserve)
                .unwrap()
        };

        require!(tokens_out >= min_tokens_out, ErrorCode::SlippageExceeded);
        require!(tokens_out > 0, ErrorCode::ZeroAmount);

        require!(
            ctx.accounts.bonding_curve_token_account.amount >= tokens_out,
            ErrorCode::InsufficientTokens
        );

        // Transfer SOL: buyer → fee wallet
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.fee_wallet.to_account_info(),
                },
            ),
            fee_lamports,
        )?;

        // Transfer SOL: buyer → bonding curve PDA
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.bonding_curve.to_account_info(),
                },
            ),
            sol_for_curve,
        )?;

        // Transfer tokens: bonding curve → buyer
        let curve_bump = ctx.accounts.bonding_curve.bump;
        let mint_key = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"bonding_curve",
            mint_key.as_ref(),
            &[curve_bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bonding_curve_token_account.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                signer_seeds,
            ),
            tokens_out,
        )?;

        let curve = &mut ctx.accounts.bonding_curve;
        curve.virtual_sol_reserve = curve
            .virtual_sol_reserve
            .checked_add(sol_for_curve)
            .unwrap();
        curve.virtual_token_reserve = curve
            .virtual_token_reserve
            .checked_sub(tokens_out)
            .unwrap();
        curve.real_sol_balance = curve.real_sol_balance.checked_add(sol_for_curve).unwrap();
        curve.real_token_reserve = curve.real_token_reserve.checked_sub(tokens_out).unwrap();
        curve.token_total_supply = curve.token_total_supply.checked_add(tokens_out).unwrap();

        if curve.real_sol_balance >= ctx.accounts.platform_config.grad_threshold {
            curve.is_graduated = true;
            emit!(TokenGraduated {
                mint: ctx.accounts.mint.key(),
                sol_raised: curve.real_sol_balance,
                timestamp: Clock::get()?.unix_timestamp,
            });
        }

        emit!(TradeExecuted {
            mint: ctx.accounts.mint.key(),
            trader: ctx.accounts.buyer.key(),
            is_buy: true,
            sol_amount,
            token_amount: tokens_out,
            fee: fee_lamports,
            timestamp: Clock::get()?.unix_timestamp,
            virtual_sol_reserve: curve.virtual_sol_reserve,
            virtual_token_reserve: curve.virtual_token_reserve,
        });

        Ok(())
    }

    pub fn sell(
        ctx: Context<Sell>,
        token_amount: u64,
        min_sol_out: u64,
    ) -> Result<()> {
        let curve = &ctx.accounts.bonding_curve;
        require!(!curve.is_graduated, ErrorCode::TokenGraduated);
        require!(token_amount > 0, ErrorCode::ZeroAmount);
        require!(
            ctx.accounts.seller_token_account.amount >= token_amount,
            ErrorCode::InsufficientTokens
        );

        let sol_out = {
            let new_token_reserve = curve
                .virtual_token_reserve
                .checked_add(token_amount)
                .unwrap();
            let k = (curve.virtual_sol_reserve as u128)
                .checked_mul(curve.virtual_token_reserve as u128)
                .unwrap();
            let new_sol_reserve = k.checked_div(new_token_reserve as u128).unwrap() as u64;
            curve
                .virtual_sol_reserve
                .checked_sub(new_sol_reserve)
                .unwrap()
        };

        let fee_lamports = sol_out
            .checked_mul(ctx.accounts.platform_config.fee_bps)
            .unwrap()
            .checked_div(BPS_DENOMINATOR)
            .unwrap();

        let sol_to_seller = sol_out.checked_sub(fee_lamports).unwrap();

        require!(sol_to_seller >= min_sol_out, ErrorCode::SlippageExceeded);
        require!(sol_out > 0, ErrorCode::ZeroAmount);
        require!(
            curve.real_sol_balance >= sol_out,
            ErrorCode::InsufficientSol
        );

        // Transfer tokens: seller → bonding curve
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.bonding_curve_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        let curve_bump = ctx.accounts.bonding_curve.bump;
        let mint_key = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"bonding_curve",
            mint_key.as_ref(),
            &[curve_bump],
        ]];

        // Transfer SOL: bonding curve → seller
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.bonding_curve.to_account_info(),
                    to: ctx.accounts.seller.to_account_info(),
                },
                signer_seeds,
            ),
            sol_to_seller,
        )?;

        // Transfer fee: bonding curve → fee wallet
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.bonding_curve.to_account_info(),
                    to: ctx.accounts.fee_wallet.to_account_info(),
                },
                signer_seeds,
            ),
            fee_lamports,
        )?;

        let curve = &mut ctx.accounts.bonding_curve;
        curve.virtual_sol_reserve = curve.virtual_sol_reserve.checked_sub(sol_out).unwrap();
        curve.virtual_token_reserve = curve
            .virtual_token_reserve
            .checked_add(token_amount)
            .unwrap();
        curve.real_sol_balance = curve.real_sol_balance.checked_sub(sol_out).unwrap();
        curve.real_token_reserve = curve.real_token_reserve.checked_add(token_amount).unwrap();
        curve.token_total_supply = curve.token_total_supply.checked_sub(token_amount).unwrap();

        emit!(TradeExecuted {
            mint: ctx.accounts.mint.key(),
            trader: ctx.accounts.seller.key(),
            is_buy: false,
            sol_amount: sol_out,
            token_amount,
            fee: fee_lamports,
            timestamp: Clock::get()?.unix_timestamp,
            virtual_sol_reserve: curve.virtual_sol_reserve,
            virtual_token_reserve: curve.virtual_token_reserve,
        });

        Ok(())
    }

    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        let curve = &mut ctx.accounts.bonding_curve;
        require!(
            curve.real_sol_balance >= ctx.accounts.platform_config.grad_threshold,
            ErrorCode::NotReadyToGraduate
        );
        require!(!curve.is_graduated, ErrorCode::AlreadyGraduated);
        
        curve.is_graduated = true;
        
        emit!(TokenGraduated {
            mint: ctx.accounts.mint.key(),
            sol_raised: curve.real_sol_balance,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

#[account]
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub fee_wallet: Pubkey,
    pub fee_bps: u64,
    pub grad_threshold: u64,
    pub total_tokens: u64,
    pub bump: u8,
}

impl PlatformConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;
}

#[account]
pub struct TokenMeta {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub description: String,
    pub created_at: i64,
    pub bump: u8,
}

impl TokenMeta {
    pub const LEN: usize = 8 + 32 + 32 + (4 + MAX_NAME_LEN) + (4 + MAX_SYMBOL_LEN) + (4 + MAX_URI_LEN) + (4 + MAX_URI_LEN) + 8 + 1;
}

#[account]
pub struct BondingCurve {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub virtual_sol_reserve: u64,
    pub virtual_token_reserve: u64,
    pub real_sol_balance: u64,
    pub real_token_reserve: u64,
    pub token_total_supply: u64,
    pub is_graduated: bool,
    pub bump: u8,
}

impl BondingCurve {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1;
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = PlatformConfig::LEN,
        seeds = [b"platform_config"],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    /// CHECK: just storing the pubkey as the fee destination
    pub fee_wallet: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        init,
        payer = creator,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = bonding_curve,
        mint::freeze_authority = bonding_curve,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = creator,
        space = TokenMeta::LEN,
        seeds = [b"token_meta", mint.key().as_ref()],
        bump
    )]
    pub token_meta: Account<'info, TokenMeta>,
    
    #[account(
        init,
        payer = creator,
        space = BondingCurve::LEN,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = fee_wallet.key() == platform_config.fee_wallet
    )]
    /// CHECK: verified via constraint
    pub fee_wallet: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = fee_wallet.key() == platform_config.fee_wallet
    )]
    /// CHECK: verified via constraint
    pub fee_wallet: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
}

#[event]
pub struct PlatformInitialized {
    pub admin: Pubkey,
    pub fee_bps: u64,
    pub grad_threshold: u64,
}

#[event]
pub struct TokenCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub timestamp: i64,
}

#[event]
pub struct TradeExecuted {
    pub mint: Pubkey,
    pub trader: Pubkey,
    pub is_buy: bool,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub fee: u64,
    pub timestamp: i64,
    pub virtual_sol_reserve: u64,
    pub virtual_token_reserve: u64,
}

#[event]
pub struct TokenGraduated {
    pub mint: Pubkey,
    pub sol_raised: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Name is empty or too long (max 32 chars)")]
    InvalidName,
    
    #[msg("Symbol is empty or too long (max 10 chars)")]
    InvalidSymbol,
    
    #[msg("URI is empty or too long (max 200 chars)")]
    InvalidUri,
    
    #[msg("Token has already graduated — trading closed")]
    TokenGraduated,
    
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    
    #[msg("Slippage tolerance exceeded — price moved too much")]
    SlippageExceeded,
    
    #[msg("Bonding curve does not have enough tokens")]
    InsufficientTokens,
    
    #[msg("Bonding curve does not have enough SOL")]
    InsufficientSol,
    
    #[msg("Token has not raised enough SOL to graduate yet")]
    NotReadyToGraduate,
    
    #[msg("Token has already been graduated")]
    AlreadyGraduated,
}