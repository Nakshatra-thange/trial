use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;


declare_id!("D8WrhNpLJ8vkf4bDZe9heZzs5zjmeedK3XScyPkeXEr1");
pub const PLATFORM_FEE_BPS:u64 = 100;
pub const BPS_DENOMINATOR :u64 = 10_000;
pub const GRADUATION_THRESHOLD_LAMPORTS:u64 = 85*1_000_000_000; //85 sol
pub const INITIAL_VIRTUAL_SOL_RESERVE: u64     = 30  * 1_000_000_000; // 30 SOL
pub const INITIAL_VIRTUAL_TOKEN_RESERVE: u64   = 1_073_000_000_000_000; // 1.073B tokens (6 decimals)
pub const INITIAL_REAL_TOKEN_RESERVE: u64      = 793_100_000_000_000;
pub const INITIAL_Rconst TOKEN_DECIMALS: u8 = 6; //6 decimal places
pub const MAX_NAME_LEN: usize   = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_URI_LEN: usize    = 200;

#[program]                           // Marks this module as the on-chain program entrypoint containing callable instructions
pub mod smooth {                    // Defines the program namespace called "smooth"
    use super::*;                   // Imports items from the parent module (accounts, structs, constants, etc.)
    /// Run once by admin after deployment.
    /// Creates the global PlatformConfig account.
    pub fn initialize_platform(     // Instruction that initializes global platform configuration on-chain
        ctx: Context<InitializePlatform>, // Provides access to all required accounts for this instruction
        fee_bps: u64,               // Input parameter: platform fee in basis points (e.g., 100 = 1%)
        graduation_threshold: u64,  // Input parameter: SOL amount required for token graduation
    ) -> Result<()> {               // Returns success or failure result to the Solana runtime
        let config = &mut ctx.accounts.platform_config; // Mutable reference to the on-chain PlatformConfig account

        config.admin          = ctx.accounts.admin.key(); // Stores admin wallet public key in config
        config.fee_bps        = fee_bps;                  // Saves chosen platform fee percentage
        config.fee_wallet     = ctx.accounts.fee_wallet.key(); // Stores wallet address where fees will be sent
        config.grad_threshold = graduation_threshold;     // Saves graduation threshold value
        config.total_tokens   = 0;                        // Initializes global token counter to zero
        config.bump           = ctx.bumps.platform_config; // Saves PDA bump used to derive this config account

        emit!(PlatformInitialized { // Emits an on-chain event for indexing and frontend tracking
            admin: config.admin,    // Includes admin address in the event log
            fee_bps,                // Includes platform fee value in the event
            grad_threshold: graduation_threshold, // Includes graduation threshold in the event
        });

        Ok(())                      // Signals successful execution of the instruction
    }
    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol : String,
        uri:String,  //Metadata URI (usually IPFS JSON)
        description:String,
    )->Result<()>{
        require!(name.len() > 0 && name.len() <= MAX_NAME_LEN,         ErrorCode::InvalidName);
        require!(symbol.len() > 0 && symbol.len() <= MAX_SYMBOL_LEN,   ErrorCode::InvalidSymbol);
        require!(uri.len() > 0 && uri.len() <= MAX_URI_LEN,            ErrorCode::InvalidUri);

        let clock= Clock::get()?;

        //initialize token meta
        let meta = &mut ctx.accounts.token_meta;
        meta.mint = ctx.accounts.mint.key();
        meta.creator= ctx.account.creator.key();
        meta.name = name.clone();
        meta.uri= uri.clone();
        meta.symbol = symbol.clone();
        meta.description= description;
        meta.created_at= clock.unix_timestamp;
        meta.bump = ctx.bumps.token_meta

        //initialize bonding curve
        let curve = &mut ctx.accounts.bonding_curve;
        curve.mint = ctx.account.mint.key();
        curve.creator = ctx.accounts.creator.key();
        curve.virtual_sol_reserve       = INITIAL_VIRTUAL_SOL_RESERVE;
        curve.virtual_token_reserve     = INITIAL_VIRTUAL_TOKEN_RESERVE;
        curve.real_sol_balance          = 0;
        curve.real_token_reserve        = INITIAL_REAL_TOKEN_RESERVE;
        curve.token_total_supply        = 0;
        curve.is_graduated              = false;
        curve.bump                      = ctx.bumps.bonding_curve;

        // ── Mint initial token supply into bonding curve token account ─────
        // All tokens start inside the bonding curve — buyers pull from here

        let mint_seed:&[&[&[u8]]]= &[&[ //pda signing authority = seeds + bump + mint add
            b"bonding_curve",  
            ctx.accounts.mint.key().as_ref(),
            &[curve.bump],    
        ]];

        //Your program is NOT minting directly. Instead: It asks another program — the SPL Token Program — to do it.

        token::mint_to(                                        // CPI call to SPL Token program to mint tokens
            CpiContext::new_with_signer(                      // new_with_signer = “I know programs can’t sign… but here are the seeds proving I AM the PDA
                ctx.accounts.token_program.to_account_info(), // SPL Token program account
                MintTo {                                       // Accounts required for mint instruction
                    mint:      ctx.accounts.mint.to_account_info(),                 
                    to:        ctx.accounts.bonding_curve_token_account.to_account_info(), 
                    authority: ctx.accounts.bonding_curve.to_account_info(),      
                },
                mint_seeds,                                   // PDA seeds allowing program to sign
            ),
            INITIAL_REAL_TOKEN_RESERVE,                       // Amount of tokens minted into bonding curve
        )?;

        ctx.accounts.platform_config.total_tokens +=1;
        emit!(TokenCreated{
            mint: ctx.accounts.mint.key(),
            creator:ctx.accounts.creator.key(),
            name,
            symbol,
            uri,
            timestamp : clock.unix_timestamp
        });
        Ok(())
    }

    pub fn buy(
        ctx:Context<Buy>,
        sol_amount: u64,
        min_tokens_out:u64
    )->Result<()>{
        let curve = &ctx.accounts.bonding_curve;
        require!(!curve.is_graduated,   ErrorCode::TokenGraduated);
        require!(sol_amount > 0,        ErrorCode::ZeroAmount);

        let fee_lamports = sol_amount
             .checked_mul(ctx.accounts.platform_config.fee_bps)
             .unwrap()
             .checked_div(BPS_DENOMINATOR)
             .unwrap();

        let sol_for_curve   = sol_amount.checked_sub(fee_lamports).unwrap();

        // Calculate tokens out using constant product formula ────────────
        // tokens_out = virtual_token_reserve - (k / (virtual_sol_reserve + sol_for_curve))
        // where k = virtual_sol_reserve * virtual_token_reserve

        //SOL_reserve × Token_reserve = constant (k)-->The more SOL people add → fewer tokens remain → price goes up.

        let tokens_out = {
            let curve           = &ctx.accounts.bonding_curve;
            let new_sol_reserve = curve.virtual_sol_reserve.checked_add(sol_for_curve).unwrap(); //new SOL = old SOL + user SOL
            let k               = (curve.virtual_sol_reserve as u128).checked_mul(curve.virtual_token_reserve as u128).unwrap();  //k = SOL × TOKENS
            let new_token_reserve = k.checked_div(new_sol_reserve as u128).unwrap() as u64; //new token amount left in machine
            curve.virtual_token_reserve .checked_sub(new_token_reserve).unwrap() //tokens_out = tokens before − tokens after
        };

        //  Slippage check
        require!(tokens_out >= min_tokens_out, ErrorCode::SlippageExceeded);
        require!(tokens_out > 0,               ErrorCode::ZeroAmount);

        //  Verify bonding curve has enough tokens 
        require!(
            ctx.accounts.bonding_curve_token_account.amount >= tokens_out,
            ErrorCode::InsufficientTokens
        );

        //  Transfer SOL: buyer → fee wallet (Move some SOL from buyer to fee wallet)
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to:   ctx.accounts.fee_wallet.to_account_info(),
                },
            ),
            fee_lamports,
        )?;
        //Transfer SOL: buyer → bonding curve PDA
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program.Transfer{
                    from: ctx.accounts.buyer.to_account_info(),
                    to:   ctx.accounts.bonding_curve.to_account_info(),
                },
            ),
            sol_for_curve,
        )?; //if error stop immediately
        //transfer token : bonding curve -> buyer
        let curve_bump = ctx.accounts.bonding_curve.bump;
        let mint_key     = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"bonding_curve",
            mint_key.as_ref(),
            &[curve_bump],
        ]];

        //transfer to buyer

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.bonding_curve_token_account.to_account_info(),
                    to:        ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                signer_seeds,
            ),
            tokens_out,
        )?;

        let curve = &mut ctx.accounts.bonding_curve;
        curve.virtual_sol_reserve   = curve.virtual_sol_reserve.checked_add(sol_for_curve).unwrap(); //add
        curve.virtual_token_reserve = curve.virtual_token_reserve.checked_sub(tokens_out).unwrap();  //sub
        curve.real_sol_balance      = curve.real_sol_balance.checked_add(sol_for_curve).unwrap();    //add
        curve.real_token_reserve    = curve.real_token_reserve.checked_sub(tokens_out).unwrap();     //sub
        curve.token_total_supply    = curve.token_total_supply.checked_add(tokens_out).unwrap();     //add
        

        // suppose more than 85 sol is done -> token gets graduated
        if curve.real_sol_balance >= ctx.accounts.platform_config.grad_threshold {
            curve.is_graduated = true;
            //if yes -> emit it 
            emit!(TokenGraduated {
                mint:      ctx.accounts.mint.key(),
                sol_raised: curve.real_sol_balance,
                timestamp:  Clock::get()?.unix_timestamp,
            });
        }
        emit!(TradeExecuted {
            mint:        ctx.accounts.mint.key(),
            trader:      ctx.accounts.buyer.key(),
            is_buy:      true,
            sol_amount,
            token_amount: tokens_out,
            fee:         fee_lamports,
            timestamp:   Clock::get()?.unix_timestamp,
            virtual_sol_reserve:   curve.virtual_sol_reserve,
            virtual_token_reserve: curve.virtual_token_reserve,
        });

        Ok(())
    }
    pub fn sell(
        ctx:Context<Sell>, 
        token_amount:u64,
        min_sol_out:u64,
    )->Result<()>{

        let curve = &ctx.accounts.bonding_curve;
        require!(!curve.is_graduated, ErrorCode::TokenGraduated);
        require!(token_amount > 0,    ErrorCode::ZeroAmount);
        require!(
            ctx.accounts.seller_token_account.amount>= token_amount,
            ErrorCode::InsufficientTokens
        );
        let sol_out={
            //add sol to virtual reserver
            let new_token_reserve= curve.virtual_token_reserve.checked_add(token_amount).unwrap();
            //k = x*y
            let k = (curve.virtual_sol_reserve as u128).checked_mul(curve.virtual_token_reserve as u128).unwrap();
            // New SOL reserve = k / new_token_reserve
            let new_sol_reserve = k.checked_div(new_token_reserve as u128).unwrap() as u64;
            // SOL out = old SOL reserve - new SOL reserve
            curve.virtual_sol_reserve.checked_sub(new_sol_reserve).unwrap()
        };
        // Calculate fee: sol_out * fee_bps / 10000 (BPS = basis points, 10000 = 100%)
        let fee_lamports    = sol_out
            .checked_mul(ctx.accounts.platform_config.fee_bps).unwrap()
            .checked_div(BPS_DENOMINATOR).unwrap();
        // Seller gets SOL minus fees
        let sol_to_seller   = sol_out.checked_sub(fee_lamports).unwrap();

        require!(sol_to_seller >= min_sol_out, ErrorCode::SlippageExceeded);
        require!(sol_out > 0,                  ErrorCode::ZeroAmount);
        require!(
            curve.real_sol_balance >= sol_out,
            ErrorCode::InsufficientSol
        );
        //  Transfer tokens: seller → bonding curve (take before giving) ───
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.seller_token_account.to_account_info(),
                    to:        ctx.accounts.bonding_curve_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        //transfer sol - bonding curve pda to seller
        let curve_bump   = ctx.accounts.bonding_curve.bump;
        let mint_key     = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"bonding_curve",
            mint_key.as_ref(),
            &[curve_bump],
        ]];

        //sol transfer to seller

        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.bonding_curve.to_account_info(),
                    to:   ctx.accounts.seller.to_account_info(),
                },
                signer_seeds,  // PDA signs as bonding curve authority
            ),
            sol_to_seller,
        )?;
        // Transfer fee: bonding curve PDA → fee wallet ─
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.bonding_curve.to_account_info(),
                    to:   ctx.accounts.fee_wallet.to_account_info(),
                },
                signer_seeds,
            ),
            fee_lamports,
        )?;
        //update bonding curve
        let curve             = &mut ctx.accounts.bonding_curve;
        // Virtual SOL reserve decreases (SOL leaves curve)
        curve.virtual_sol_reserve   = curve.virtual_sol_reserve.checked_sub(sol_out).unwrap();
        // Virtual token reserve increases (tokens added to curve)
        curve.virtual_token_reserve = curve.virtual_token_reserve.checked_add(token_amount).unwrap();
        // Real SOL balance decreases (actual SOL sent out)
        curve.real_sol_balance      = curve.real_sol_balance.checked_sub(sol_out).unwrap();
        // Real token balance increases (actual tokens received)
        curve.real_token_reserve    = curve.real_token_reserve.checked_add(token_amount).unwrap();
        // Total supply decreases (tokens are burned/removed from circulation)
        curve.token_total_supply    = curve.token_total_supply.checked_sub(token_amount).unwrap();

        emit!(TradeExecuted {
            mint:         ctx.accounts.mint.key(),
            trader:       ctx.accounts.seller.key(),
            is_buy:       false,
            sol_amount:   sol_out,
            token_amount,
            fee:          fee_lamports,
            timestamp:    Clock::get()?.unix_timestamp,
            virtual_sol_reserve:   curve.virtual_sol_reserve,
            virtual_token_reserve: curve.virtual_token_reserve,
        });

        Ok(())
    }
    pub fn graduate(
        ctx:Coontext<Graduate>)->Result<()>{
            let curve = &ctx.accounts.bonding_curve;
            require!(
                curve.real_sol_balance >= ctx.accounts.platform_config.grad_threshold,
                ErrorCode::NotReadyToGraduate
            );
            require!(!curve.is_graduated, ErrorCode::AlreadyGraduated);
            ctx.accounts.bonding_curve.is_graduated = true;
            emit!(TokenGraduated{
                mint:ctx.accounts.mint.key(),
                sol_raised:curve.real_sol_balance,
                timestamp:Clock::get()?.unix_timestamp
            });
            Ok(())
        }}


    #[account]  // Anchor macro to define a Solana account struct
    pub struct PlatformConfig {
    pub admin:          Pubkey,   // 32 bytes - Address with admin privileges
    pub fee_wallet:     Pubkey,   // 32 bytes - Where fees are sent
    pub fee_bps:        u64,      // 8 bytes  - Fee in basis points (100 = 1%)
    pub grad_threshold: u64,      // 8 bytes  - Minimum SOL to graduate (in lamports)
    pub total_tokens:   u64,      // 8 bytes  - Counter of tokens created on this platform
    pub bump:           u8,       // 1 byte   - PDA bump seed for this account
}   
    impl PlatformConfig {
    // Calculate total account size: 8 (Anchor discriminator) + 32+32+8+8+8+1 = 97 bytes
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;
}
    #[account]
    pub struct TokenMeta{
        pub mint: Pubkey,
        pub creator : Pubkey,
        pub name : String,
        pub symbol : String,
        pub uri : String,
        pub description : String,
        pub created_at : i64,
        pub bump : u8
    }
    impl TokenMeta {
        // 8 + 32 + 32 + (4+32) + (4+10) + (4+200) + (4+200) + 8 + 1 = 539
        pub const LEN : usize = 8 + 32 + 32 + 36 + 14 + 204 + 204 + 8 + 1;
    }
    #[account]
    pub struct BondingCurve {
    pub mint:                    Pubkey,  // 32 - Token mint this curve is for
    pub creator:                 Pubkey,  // 32 - Who created the curve
    pub virtual_sol_reserve:     u64,     // 8 - Virtual SOL for pricing (can differ from real)
    pub virtual_token_reserve:   u64,     // 8 - Virtual tokens for pricing
    pub real_sol_balance:        u64,     // 8 - Actual SOL held by curve
    pub real_token_reserve:      u64,     // 8 - Actual tokens still in curve
    pub token_total_supply:      u64,     // 8 - Total tokens sold so far
    pub is_graduated:            bool,    // 1 - Whether token graduated to DEX
    pub bump:                    u8,      // 1 - PDA bump seed
}
    impl BondingCurve {
    // 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 = 114 bytes
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1;
}

//INSTRUCTION CONTEXTS
    #[derive(Accounts)] //Anchor macro to validate and deserialize accounts
    pub struct InitializePlatform<'info>{
        // Admin account that pays for initialization and will have admin privileges
        #[account(mut)] //--> this account will be modified
        pub admin : Signer <'info>, //signer ensures this account signed tx
        #[account(
        init,
        payer  = admin,
        space  = PlatformConfig::LEN,
        seeds  = [b"platform_config"],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    /// CHECK: just storing the pubkey as the fee destination
    pub fee_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
   #[derive(Accounts)]
   pub struct CreateToken<'info>{
      #[account(mut)]
      pub creator : Signer<'info>,
       #[account(
        seeds  = [b"platform_config"],
        bump   = platform_config.bump,
    )]
      pub platform_config: Account<'info, PlatformConfig>,
    //mint a special token
    #[account(
      init,                    // Create new mint account
      payer = creator,         // Creator pays
      mint::decimals = TOKEN_DECIMALS,        // Usually 9 or 6
      mint::authority = bonding_curve,        // Curve can mint/burn
      mint::freeze_authority = bonding_curve, // Curve can freeze
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator ,
        space = TokenMeta::LEN,
        seeds= [b"token_meta",mint_key().as_ref()],
        bump
    )]
    pub token_meta: Account<'info, TokenMeta>,

    #[account(
      init,                    
      payer = creator,        
      space = BondingCurve::LEN, 
      seeds = [b"bonding_curve", mint.key().as_ref()], // PDA: ["bonding_curve", mint_address]
      bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
      init,                    
      payer = creator,         
      associated_token::mint = mint,           // For this token
      associated_token::authority = bonding_curve, // Owned by curve
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,
    pub token_program : Program<'info, Token>,
    pub associated_token_program : Program<'info, System>,
    pub rent : Sysvar<'info, Rent>
    }

pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,  // Person buying tokens (pays SOL)

    #[account(
        seeds = [b"platform_config"],
        bump  = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,  // Global settings

    pub mint: Account<'info, Mint>,  // Token being purchased

    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump  = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,  // Trading pool (will update)

    /// Bonding curve's token reserve — tokens leave from here
    #[account(
        mut,
        associated_token::mint      = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,  // Curve's token vault

    /// Buyer's token account — tokens arrive here (create if needed)
    #[account(
        init_if_needed,  // creates account if buyer doesn't have one
        payer             = buyer,
        associated_token::mint      = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,  // Where buyer receives tokens

    /// CHECK: verified via platform_config.fee_wallet
    #[account(
        mut,
        constraint = fee_wallet.key() == platform_config.fee_wallet  // 👈 Verify correct fee wallet
    )]
    pub fee_wallet: UncheckedAccount<'info>,  // Where fees go

    pub token_program:            Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:           Program<'info, System>,
}
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,  // Person selling tokens (receives SOL)

    #[account(
        seeds = [b"platform_config"],
        bump  = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,  // Global settings

    pub mint: Account<'info, Mint>,  // Token being sold

    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump  = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,  // Trading pool (will update)

    /// Bonding curve's token reserve — tokens return here
    #[account(
        mut,
        associated_token::mint      = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,  // Curve's token vault

    /// Seller's token account — tokens leave from here
    #[account(
        mut,
        associated_token::mint      = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,  // Where seller's tokens are

    /// CHECK: verified via platform_config.fee_wallet
    #[account(
        mut,
        constraint = fee_wallet.key() == platform_config.fee_wallet  // 👈 Verify correct fee wallet
    )]
    pub fee_wallet: UncheckedAccount<'info>,  // Where fees go

    pub token_program:   Program<'info, Token>,
    pub system_program:  Program<'info, System>,
}
pub struct Graduate<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,  // Anyone can call if threshold met

    #[account(
        seeds = [b"platform_config"],
        bump  = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,  // Global settings (has threshold)

    pub mint: Account<'info, Mint>,  // Token graduating

    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump  = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,  // Will be marked graduated
}
#[event]
pub struct PlatformInitialized {
    pub admin:          Pubkey,
    pub fee_bps:        u64,
    pub grad_threshold: u64,
}

#[event]
pub struct TokenCreated {
    pub mint:      Pubkey,
    pub creator:   Pubkey,
    pub name:      String,
    pub symbol:    String,
    pub uri:       String,
    pub timestamp: i64,
}

#[event]
pub struct TradeExecuted {
    pub mint:                  Pubkey,
    pub trader:                Pubkey,
    pub is_buy:                bool,
    pub sol_amount:            u64,
    pub token_amount:          u64,
    pub fee:                   u64,
    pub timestamp:             i64,
    pub virtual_sol_reserve:   u64,    // current price snapshot
    pub virtual_token_reserve: u64,
}

#[event]
pub struct TokenGraduated {
    pub mint:       Pubkey,
    pub sol_raised: u64,
    pub timestamp:  i64,

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
    

    





    




    
    
    
    
    
    

    


    


