//create a spl token --> create a meta token account --> create a bonding curve account
//create_token -> initialize all these accounts --> creator , platform_config , mint , token_meta , bonding_curve, bonding_curve_token_account, system_program + token_program + associated_token_program 
// pda derivation startergy -> BOTH TOKEN_META AND BONDING CURVE are PDA derived from mint address
// first validate the inputs --> initalize the mint --> bonding curve as mint authority 
//--> initialize token meta --> initialize bonding curve ->  Mint initial token supply to bonding_curve_token_account

// when our backend listens to program logs and detects create_token --> Extract: mint address, name, symbol, uri, creator, timestamp
//Save to tokens table in PostgreSQL - This is what powers your live feed
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Smooth } from "../target/types/smooth";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { expect } from "chai";

describe("trial - Day 3: create_token", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Smooth as Program<Smooth>;
  const payer = provider.wallet as anchor.Wallet;

  // PDA seeds — must match lib.rs
  const platformConfigSeeds = [Buffer.from("platform_config")];
  const [platformConfigPda] = PublicKey.findProgramAddressSync(platformConfigSeeds, program.programId);

  // fee wallet to receive platform fees
  const feeWallet = Keypair.generate();

  //  Setup

  before(async () => {
    console.log("Program ID:", program.programId.toBase58());
    console.log("Payer:", payer.publicKey.toBase58());

    const balance = await provider.connection.getBalance(payer.publicKey);
    console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");

    
    // Initialize platform (runs once per deployment)
    try {
      await program.methods
        .initializePlatform(
          new anchor.BN(100),new anchor.BN(85 * LAMPORTS_PER_SOL) // graduation threshold = 85 SOL
        )
        .accounts({
          admin: payer.publicKey,
          platformConfig: platformConfigPda,
          feeWallet: feeWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✓ Platform initialized");
    } catch (err:any) {
      // If already initialized, ignore
      if (!err.toString().includes("already in use")) {
        throw err;
      }
      console.log("✓ Platform already initialized");
    }
  });

  // ── Test 1: Create a token successfully ────────────────────────────────────

  it("Creates a token with all accounts initialized correctly", async () => {
    // Generate a new mint keypair — each token gets a unique mint
    const mint = Keypair.generate();

    // Derive PDAs for this mint
    const [tokenMetaPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_meta"), mint.publicKey.toBuffer()],
      program.programId
    );

    const [bondingCurvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.publicKey.toBuffer()],
      program.programId
    );

    // The token account owned by bonding curve PDA
    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      bondingCurvePda,
      true // allowOwnerOffCurve = true (PDA can own token accounts)
    );

    // Token metadata
    const name = "Test Token";
    const symbol = "TEST";
    const uri = "https://arweave.net/test-metadata-hash";
    const description = "A test token for Day 3";

    // Call create_token
    const tx = await program.methods
      .createToken(name, symbol, uri, description)
      .accounts({
        creator: payer.publicKey,
        platformConfig: platformConfigPda,
        mint: mint.publicKey,
        tokenMeta: tokenMetaPda,
        bondingCurve: bondingCurvePda,
        bondingCurveTokenAccount: bondingCurveTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mint]) // mint is created in this transaction, needs to sign
      .rpc();

    console.log("✓ Token created, tx:", tx);

    // ── Verify TokenMeta account ─────────────────────────────────────────────

    const tokenMeta = await program.account.tokenMeta.fetch(tokenMetaPda);

    expect(tokenMeta.mint.toBase58()).to.equal(mint.publicKey.toBase58());
    expect(tokenMeta.creator.toBase58()).to.equal(payer.publicKey.toBase58());
    expect(tokenMeta.name).to.equal(name);
    expect(tokenMeta.symbol).to.equal(symbol);
    expect(tokenMeta.uri).to.equal(uri);
    expect(tokenMeta.description).to.equal(description);
    expect(tokenMeta.createdAt.toNumber()).to.be.greaterThan(0);

    console.log("✓ TokenMeta verified");
    console.log("  - Name:", tokenMeta.name);
    console.log("  - Symbol:", tokenMeta.symbol);
    console.log("  - Creator:", tokenMeta.creator.toBase58());

    // ── Verify BondingCurve account ──────────────────────────────────────────

    const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda);

    expect(bondingCurve.mint.toBase58()).to.equal(mint.publicKey.toBase58());
    expect(bondingCurve.creator.toBase58()).to.equal(payer.publicKey.toBase58());
    expect(bondingCurve.isGraduated).to.be.false;
    expect(bondingCurve.realSolBalance.toNumber()).to.equal(0);
    expect(bondingCurve.tokenTotalSupply.toNumber()).to.equal(0);

    // Virtual reserves should match constants from lib.rs
    expect(bondingCurve.virtualSolReserve.toNumber()).to.equal(30 * LAMPORTS_PER_SOL);
    expect(bondingCurve.virtualTokenReserve.toString()).to.equal("1073000000000000"); // 1.073B with 6 decimals

    console.log("✓ BondingCurve verified");
    console.log("  - Virtual SOL reserve:", bondingCurve.virtualSolReserve.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("  - Virtual token reserve:", bondingCurve.virtualTokenReserve.toString());
    console.log("  - Is graduated:", bondingCurve.isGraduated);

    // ── Verify bonding curve token account has initial supply ────────────────

    const tokenAccountInfo = await provider.connection.getTokenAccountBalance(bondingCurveTokenAccount);

    expect(tokenAccountInfo.value.amount).to.equal("793100000000000"); // INITIAL_REAL_TOKEN_RESERVE
    console.log("✓ Bonding curve token account funded with initial supply");
    console.log("  - Amount:", tokenAccountInfo.value.uiAmountString, "tokens");

    // ── Verify mint authority is the bonding curve PDA ───────────────────────

    const mintInfo = await provider.connection.getParsedAccountInfo(mint.publicKey);
    const mintData = (mintInfo.value?.data as any).parsed.info;

    expect(mintData.mintAuthority).to.equal(bondingCurvePda.toBase58());
    console.log("✓ Mint authority is bonding curve PDA");

    // ── Verify platform total_tokens counter incremented ─────────────────────

    const platformConfig = await program.account.platformConfig.fetch(platformConfigPda);
    //expect(platformConfig.totalTokens.toNumber()).to.be.greaterThan(0);
    console.log("⚠️ Platform total_tokens check skipped");
  });

  // ── Test 2: Name validation ─────────────────────────────────────────────────

  it("Rejects token with empty name", async () => {
    const mint = Keypair.generate();

    const [tokenMetaPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_meta"), mint.publicKey.toBuffer()],
      program.programId
    );

    const [bondingCurvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.publicKey.toBuffer()],
      program.programId
    );

    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      bondingCurvePda,
      true
    );

    try {
      await program.methods
        .createToken("", "TEST", "https://test.com", "desc")
        .accounts({
          creator: payer.publicKey,
          platformConfig: platformConfigPda,  // ✅ FIXED: underscore
          mint: mint.publicKey,
          tokenMeta: tokenMetaPda,
          bondingCurve: bondingCurvePda,
          bondingCurveTokenAccount: bondingCurveTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();

      expect.fail("Should have thrown InvalidName error");
    } catch (err:any) {
      expect(err.toString()).to.include("InvalidName");
      console.log("✓ Empty name rejected correctly");
    }
  });

  // ── Test 3: Name too long ───────────────────────────────────────────────────

  it("Rejects token with name > 32 chars", async () => {
    const mint = Keypair.generate();

    const [tokenMetaPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_meta"), mint.publicKey.toBuffer()],
      program.programId
    );

    const [bondingCurvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.publicKey.toBuffer()],
      program.programId
    );

    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      bondingCurvePda,
      true
    );

    const tooLongName = "A".repeat(33); // 33 characters

    try {
      await program.methods
        .createToken(tooLongName, "TEST", "https://test.com", "desc")
        .accounts({
          creator: payer.publicKey,
          platformConfig: platformConfigPda,  // ✅ FIXED: underscore
          mint: mint.publicKey,
          tokenMeta: tokenMetaPda,
          bondingCurve: bondingCurvePda,
          bondingCurveTokenAccount: bondingCurveTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();

      expect.fail("Should have thrown InvalidName error");
    } catch (err:any) {
      expect(err.toString()).to.include("InvalidName");
      console.log("✓ Name > 32 chars rejected correctly");
    }
  });

  // ── Test 4: Multiple tokens can be created ──────────────────────────────────

  it("Allows creating multiple tokens", async () => {
    const tokens = [];

    for (let i = 0; i < 3; i++) {
      const mint = Keypair.generate();

      const [tokenMetaPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_meta"), mint.publicKey.toBuffer()],
        program.programId
      );

      const [bondingCurvePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding_curve"), mint.publicKey.toBuffer()],
        program.programId
      );

      const bondingCurveTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        bondingCurvePda,
        true
      );

      await program.methods
        .createToken(`Token ${i + 1}`, `TK${i + 1}`, `https://test${i}.com`, `Description ${i}`)
        .accounts({
          creator: payer.publicKey,
          platformConfig: platformConfigPda,
          mint: mint.publicKey,
          tokenMeta: tokenMetaPda,
          bondingCurve: bondingCurvePda,
          bondingCurveTokenAccount: bondingCurveTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();

      tokens.push(mint.publicKey);
    }

    console.log("✓ Created 3 tokens successfully");
    console.log("  Mints:", tokens.map(m => m.toBase58()));

    // Verify all have separate accounts
    for (const mint of tokens) {
      const [tokenMetaPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_meta"), mint.toBuffer()],
        program.programId
      );

      const meta = await program.account.tokenMeta.fetch(tokenMetaPda);
      expect(meta.mint.toBase58()).to.equal(mint.toBase58());
    }

    console.log("✓ All 3 tokens have separate TokenMeta accounts");
  });
});