/**
 * tradingService.ts
 * 
 * Type-safe Solana transaction builder for buy/sell
 * NO Anchor SDK - pure @solana/web3.js to avoid type issues
 */

import { 
    Connection, 
    PublicKey, 
    Transaction, 
    TransactionInstruction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY
  } from "@solana/web3.js";
  import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction
  } from "@solana/spl-token";
  
  const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID || "");
  
  // Instruction discriminators (hash of "global:instruction_name")
  // These are the first 8 bytes of SHA256("global:buy")
  const BUY_DISCRIMINATOR = Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);
  const SELL_DISCRIMINATOR = Buffer.from([0x51, 0x23, 0x04, 0xe1, 0x20, 0x7c, 0x89, 0xf3]);
  const CREATE_TOKEN_DISCRIMINATOR = Buffer.from([0x18, 0x1e, 0xc8, 0x28, 0x05, 0x1c, 0x07, 0x77]);
  
  /**
   * Manually parse platform config account
   */
  async function getPlatformFeeWallet(connection: Connection): Promise<PublicKey> {
    const [platformConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform_config")],
      PROGRAM_ID
    );
  
    const accountInfo = await connection.getAccountInfo(platformConfigPda);
    if (!accountInfo) {
      throw new Error("Platform config account not found. Is the program initialized?");
    }
  
    // Account layout (matches your Rust struct):
    // 8 bytes: discriminator
    // 32 bytes: admin pubkey
    // 32 bytes: fee_wallet pubkey  <- we want this
    const feeWalletBytes = accountInfo.data.slice(8 + 32, 8 + 32 + 32);
    return new PublicKey(feeWalletBytes);
  }
  
  /**
   * Check if associated token account exists, create if not
   */
  async function getOrCreateATA(
    connection: Connection,
    payer: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve: boolean = false
  ): Promise<{ address: PublicKey; instruction: TransactionInstruction | null }> {
    const ata = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve);
    
    const accountInfo = await connection.getAccountInfo(ata);
    
    if (accountInfo) {
      return { address: ata, instruction: null };
    }
  
    // Need to create it
    const instruction = createAssociatedTokenAccountInstruction(
      payer,
      ata,
      owner,
      mint
    );
  
    return { address: ata, instruction };
  }
  
  /**
   * Buy tokens - returns transaction signature
   */
  export async function buyTokens(
    connection: Connection,
    userPublicKey: PublicKey,
    signTransaction: (tx: Transaction) => Promise<Transaction>,
    mint: PublicKey,
    solAmountLamports: bigint,
    minTokensOut: bigint
  ): Promise<string> {
    // Derive all PDAs
    const [platformConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform_config")],
      PROGRAM_ID
    );
  
    const [bondingCurvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.toBuffer()],
      PROGRAM_ID
    );
  
    // Get bonding curve's token account
    const bondingCurveATA = getAssociatedTokenAddressSync(
      mint,
      bondingCurvePda,
      true // allowOwnerOffCurve
    );
  
    // Get or create user's token account
    const { address: buyerATA, instruction: createATAIx } = await getOrCreateATA(
      connection,
      userPublicKey,
      mint,
      userPublicKey
    );
  
    // Get fee wallet
    const feeWallet = await getPlatformFeeWallet(connection);
  
    // Build instruction data: discriminator + sol_amount + min_tokens_out
    const data = Buffer.concat([
      BUY_DISCRIMINATOR,
      Buffer.from(new BigUint64Array([solAmountLamports]).buffer),
      Buffer.from(new BigUint64Array([minTokensOut]).buffer),
    ]);
  
    // Build accounts array (order must match your Rust program)
    const keys = [
      { pubkey: userPublicKey, isSigner: true, isWritable: true },           // buyer
      { pubkey: platformConfigPda, isSigner: false, isWritable: false },     // platform_config
      { pubkey: mint, isSigner: false, isWritable: false },                  // mint
      { pubkey: bondingCurvePda, isSigner: false, isWritable: true },        // bonding_curve
      { pubkey: bondingCurveATA, isSigner: false, isWritable: true },        // bonding_curve_token_account
      { pubkey: buyerATA, isSigner: false, isWritable: true },               // buyer_token_account
      { pubkey: feeWallet, isSigner: false, isWritable: true },              // fee_wallet
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },      // token_program
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ];
  
    const buyIx = new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  
    // Build transaction
    const transaction = new Transaction();
    
    // Add create ATA instruction if needed
    if (createATAIx) {
      transaction.add(createATAIx);
    }
    
    transaction.add(buyIx);
  
    // Set recent blockhash and fee payer
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;
  
    // Sign transaction
    const signed = await signTransaction(transaction);
  
    // Send transaction
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
  
    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });
  
    return signature;
  }
  
  /**
   * Sell tokens - returns transaction signature
   */
  export async function sellTokens(
    connection: Connection,
    userPublicKey: PublicKey,
    signTransaction: (tx: Transaction) => Promise<Transaction>,
    mint: PublicKey,
    tokenAmountBase: bigint,
    minSolOut: bigint
  ): Promise<string> {
    const [platformConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform_config")],
      PROGRAM_ID
    );
  
    const [bondingCurvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.toBuffer()],
      PROGRAM_ID
    );
  
    const bondingCurveATA = getAssociatedTokenAddressSync(
      mint,
      bondingCurvePda,
      true
    );
  
    const sellerATA = getAssociatedTokenAddressSync(
      mint,
      userPublicKey
    );
  
    const feeWallet = await getPlatformFeeWallet(connection);
  
    const data = Buffer.concat([
      SELL_DISCRIMINATOR,
      Buffer.from(new BigUint64Array([tokenAmountBase]).buffer),
      Buffer.from(new BigUint64Array([minSolOut]).buffer),
    ]);
  
    const keys = [
      { pubkey: userPublicKey, isSigner: true, isWritable: true },
      { pubkey: platformConfigPda, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurvePda, isSigner: false, isWritable: true },
      { pubkey: bondingCurveATA, isSigner: false, isWritable: true },
      { pubkey: sellerATA, isSigner: false, isWritable: true },
      { pubkey: feeWallet, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  
    const sellIx = new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  
    const transaction = new Transaction().add(sellIx);
  
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;
  
    const signed = await signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
  
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });
  
    return signature;
  }
  
  /**
   * Create token - returns transaction signature and mint address
   */
  export async function createToken(
    connection: Connection,
    userPublicKey: PublicKey,
    signTransaction: (tx: Transaction) => Promise<Transaction>,
    name: string,
    symbol: string,
    uri: string,
    description: string
  ): Promise<{ signature: string; mint: PublicKey }> {
    // Generate new mint keypair
    const { Keypair } = await import("@solana/web3.js");
    const mintKeypair = Keypair.generate();
  
    const [platformConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform_config")],
      PROGRAM_ID
    );
  
    const [tokenMetaPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_meta"), mintKeypair.publicKey.toBuffer()],
      PROGRAM_ID
    );
  
    const [bondingCurvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mintKeypair.publicKey.toBuffer()],
      PROGRAM_ID
    );
  
    const bondingCurveATA = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      bondingCurvePda,
      true
    );
  
    // Encode strings
    const nameBytes = Buffer.from(name, "utf8");
    const symbolBytes = Buffer.from(symbol, "utf8");
    const uriBytes = Buffer.from(uri, "utf8");
    const descBytes = Buffer.from(description, "utf8");
  
    const data = Buffer.concat([
      CREATE_TOKEN_DISCRIMINATOR,
      Buffer.from(new Uint32Array([nameBytes.length]).buffer),
      nameBytes,
      Buffer.from(new Uint32Array([symbolBytes.length]).buffer),
      symbolBytes,
      Buffer.from(new Uint32Array([uriBytes.length]).buffer),
      uriBytes,
      Buffer.from(new Uint32Array([descBytes.length]).buffer),
      descBytes,
    ]);
  
    const keys = [
      { pubkey: userPublicKey, isSigner: true, isWritable: true },
      { pubkey: platformConfigPda, isSigner: false, isWritable: true },
      { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: tokenMetaPda, isSigner: false, isWritable: true },
      { pubkey: bondingCurvePda, isSigner: false, isWritable: true },
      { pubkey: bondingCurveATA, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
  
    const createTokenIx = new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  
    const transaction = new Transaction().add(createTokenIx);
  
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;
  
    // Partially sign with mint keypair
    transaction.partialSign(mintKeypair);
  
    // Sign with user wallet
    const signed = await signTransaction(transaction);
  
    const signature = await connection.sendRawTransaction(signed.serialize());
  
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });
  
    return { signature, mint: mintKeypair.publicKey };
  }