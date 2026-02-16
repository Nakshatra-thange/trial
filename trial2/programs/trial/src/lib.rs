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



    }




    
    
    
    
    
    

    


    


