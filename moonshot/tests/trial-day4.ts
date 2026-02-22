import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Smooth } from "../target/types/smooth";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { expect } from "chai";

describe("trial - Day 4: buy and sell", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Smooth as Program<Smooth>;
  const payer = provider.wallet as anchor.Wallet;

  const platformConfigSeeds = [Buffer.from("platform_config")];
  const [platformConfigPda] = PublicKey.findProgramAddressSync(platformConfigSeeds, program.programId);

  let feeWallet: PublicKey;  

  // We'll create one token and reuse it for all tests
  let testMint: Keypair;
  let tokenMetaPda: PublicKey;
  let bondingCurvePda: PublicKey;
  let bondingCurveTokenAccount: PublicKey;

  // ── Setup ───────────────────────────────────────────────────────────────────

  before(async () => {
    console.log("\n=== Setup ===");

    // Airdrop to payer
   
    const balance = await provider.connection.getBalance(payer.publicKey);
  console.log(`Payer balance: ${balance / LAMPORTS_PER_SOL} SOL`)

    // Initialize platform if not done
    // Fetch the REAL fee wallet from platform config
    const platformConfig = await program.account.platformConfig.fetch(platformConfigPda);
    feeWallet = platformConfig.feeWallet;
    console.log("✓ Using fee wallet:", feeWallet.toBase58());
    

    // Create test token
    testMint = Keypair.generate();

    [tokenMetaPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_meta"), testMint.publicKey.toBuffer()],
      program.programId
    );

    [bondingCurvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), testMint.publicKey.toBuffer()],
      program.programId
    );

    bondingCurveTokenAccount = await getAssociatedTokenAddress(
      testMint.publicKey,
      bondingCurvePda,
      true
    );

    await program.methods
      .createToken("Day 4 Token", "DAY4", "https://test.com/day4", "Testing buy/sell")
      .accounts({
        creator: payer.publicKey,
        platformConfig: platformConfigPda,
        mint: testMint.publicKey,
        tokenMeta: tokenMetaPda,
        bondingCurve: bondingCurvePda,
        bondingCurveTokenAccount: bondingCurveTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([testMint])
      .rpc();

    console.log("✓ Test token created:", testMint.publicKey.toBase58());
  });

  // test 1 - buy tokens 
  // 1. ready cuurent state (virtual sol reserve and virtual token reserve 
  // 2. calcuate tokens out --> token reciever should recieve
  //3. validate + slippage check 
  //4 . calculate fee + collect platform fee
  //5. transform sol into bonding curve 
  //6 . transfer tokens to buyers
  //7. update bonding curve state
//   virtual_sol_reserve += sol_for_curve
// virtual_token_reserve -= tokens_out
// real_sol_balance += sol_for_curve
// token_total_supply += tokens_out
  //8 . check graduation if more than 85
  

  it("Buys tokens and updates state correctly", async () => {
    const buyerTokenAccount = await getAssociatedTokenAddress(
      testMint.publicKey,
      payer.publicKey
    );
    const solAmount = 1* LAMPORTS_PER_SOL;
    const minTokensOut = 0;
    const curveBefore = await program.account.bondingCurve.fetch(bondingCurvePda);
    const feeWalletBalanceBefore = await provider.connection.getBalance(feeWallet);

    console.log("\n=== Before Buy ===");
    console.log("Virtual SOL reserve:", curveBefore.virtualSolReserve.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("Virtual token reserve:", curveBefore.virtualTokenReserve.toString());
    console.log("Real SOL balance:", curveBefore.realSolBalance.toNumber() / LAMPORTS_PER_SOL, "SOL");

    const tx = await program.methods.buy(new anchor.BN(solAmount), new anchor .BN(minTokensOut)).accounts({
        buyer: payer.publicKey,
        platformConfig: platformConfigPda,
        mint: testMint.publicKey,
        bondingCurve: bondingCurvePda,
        bondingCurveTokenAccount: bondingCurveTokenAccount,
        buyerTokenAccount: buyerTokenAccount,
        feeWallet: feeWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
    })
    .rpc();
    console.log("buy txns:",tx);
    const curveAfter = await program.account.bondingCurve.fetch(bondingCurvePda);
    const buyerBalance = await provider.connection.getTokenAccountBalance(buyerTokenAccount);
    const feeWalletBalanceAfter = await provider.connection.getBalance(feeWallet);

    console.log("\n=== After Buy ===");
    console.log("Virtual SOL reserve:", curveAfter.virtualSolReserve.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("Virtual token reserve:", curveAfter.virtualTokenReserve.toString());
    console.log("Real SOL balance:", curveAfter.realSolBalance.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("Buyer token balance:", buyerBalance.value.uiAmountString, "tokens");
    console.log("Fee collected:", (feeWalletBalanceAfter - feeWalletBalanceBefore) / LAMPORTS_PER_SOL, "SOL");

    expect(curveAfter.virtualSolReserve.gt(curveBefore.virtualSolReserve)).to.be.true;
    expect(curveAfter.virtualTokenReserve.lt(curveBefore.virtualTokenReserve)).to.be.true;
    expect(curveAfter.realSolBalance.gt(curveBefore.realSolBalance)).to.be.true;
    expect(curveAfter.tokenTotalSupply.gt(curveBefore.tokenTotalSupply)).to.be.true;
    expect(Number(buyerBalance.value.amount)).to.be.greaterThan(0);

    const expectedFee = 0.01 * LAMPORTS_PER_SOL;
    const actualFee = feeWalletBalanceAfter - feeWalletBalanceBefore;
    expect(actualFee).to.equal(expectedFee);

    console.log("all states update verified")
});
//test 2 - Buys 0.5 SOL worth of tokens 3 times in a row and Tracks how many tokens are received each time
it("Price increases with each consecutive buy", async () => {
    const buyerTokenAccount = await getAssociatedTokenAddress(
      testMint.publicKey,
      payer.publicKey
    );

    const solAmount = 0.5 * LAMPORTS_PER_SOL; // 0.5 SOL each buy
    let lastTokensReceived = Number.MAX_SAFE_INTEGER;

    console.log("\n=== Testing Price Increase ===");
    for (let i = 0; i < 3; i++) {
      const balanceBefore = await provider.connection.getTokenAccountBalance(buyerTokenAccount);

      await program.methods
        .buy(new anchor.BN(solAmount), new anchor.BN(0))
        .accounts({
          buyer: payer.publicKey,
          platformConfig: platformConfigPda,
          mint: testMint.publicKey,
          bondingCurve: bondingCurvePda,
          bondingCurveTokenAccount: bondingCurveTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          feeWallet: feeWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

        const balanceAfter = await provider.connection.getTokenAccountBalance(buyerTokenAccount);
        const tokensReceived = Number(balanceAfter.value.amount) - Number(balanceBefore.value.amount);
        console.log(`Buy ${i + 1}: 0.5 SOL → ${(tokensReceived / 1e6).toFixed(2)} tokens`);

        expect(tokensReceived).to.be.lessThan(lastTokensReceived);
        lastTokensReceived = tokensReceived;
    }
    console.log("✓ Price increased as expected");
});
//test 3 --sell tokens
it("Sells tokens and receives SOL back", async () => {
    const buyerTokenAccount = await getAssociatedTokenAddress(
      testMint.publicKey,
      payer.publicKey
    );

    const tokenBalance = await provider.connection.getTokenAccountBalance(buyerTokenAccount);
    const tokensToSell = Math.floor(Number(tokenBalance.value.amount) / 2); // sell half

    console.log("\n=== Selling Tokens ===");
    console.log("Current balance:", Number(tokenBalance.value.amount) / 1e6, "tokens");
    console.log("Selling:", tokensToSell / 1e6, "tokens");

    // Get SOL balance before sell
    const solBalanceBefore = await provider.connection.getBalance(payer.publicKey);
    const curveBefore = await program.account.bondingCurve.fetch(bondingCurvePda);

    const tx = await program.methods
      .sell(new anchor.BN(tokensToSell), new anchor.BN(0)) // min_sol_out = 0
      .accounts({
        seller: payer.publicKey,
        platformConfig: platformConfigPda,
        mint: testMint.publicKey,
        bondingCurve: bondingCurvePda,
        bondingCurveTokenAccount: bondingCurveTokenAccount,
        sellerTokenAccount: buyerTokenAccount,
        feeWallet: feeWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✓ Sell transaction:", tx);
    const solBalanceAfter = await provider.connection.getBalance(payer.publicKey);
    const curveAfter = await program.account.bondingCurve.fetch(bondingCurvePda);
    const tokenBalanceAfter = await provider.connection.getTokenAccountBalance(buyerTokenAccount);

    const solReceived = solBalanceAfter - solBalanceBefore;

    console.log("SOL received:", solReceived / LAMPORTS_PER_SOL, "SOL");
    console.log("Tokens remaining:", Number(tokenBalanceAfter.value.amount) / 1e6, "tokens");

    // Verify state changes (opposite of buy)
    expect(curveAfter.virtualSolReserve.lt(curveBefore.virtualSolReserve)).to.be.true;
    expect(curveAfter.virtualTokenReserve.gt(curveBefore.virtualTokenReserve)).to.be.true;
    expect(curveAfter.realSolBalance.lt(curveBefore.realSolBalance)).to.be.true;
    expect(curveAfter.tokenTotalSupply.lt(curveBefore.tokenTotalSupply)).to.be.true;

    // Verify seller received SOL (accounting for tx fee)
    expect(solReceived).to.be.greaterThan(-10_000_000); // should be positive minus small tx fee

    console.log("Sell verified");
})

//test 4 --> buy and sell --> should lose the money 
it("Round trip (buy then sell) results in net loss due to fees", async () => {
    const buyer = Keypair.generate();

    // Airdrop to new buyer
    const airdropSig = await provider.connection.requestAirdrop(buyer.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdropSig);

    const buyerTokenAccount = await getAssociatedTokenAddress(
      testMint.publicKey,
      buyer.publicKey
    );

    const startingSol = await provider.connection.getBalance(buyer.publicKey);
    const solToSpend = 1 * LAMPORTS_PER_SOL;

    console.log("\n=== Round Trip Test ===");
    console.log("Starting SOL:", startingSol / LAMPORTS_PER_SOL);

    // Buy
    await program.methods
      .buy(new anchor.BN(solToSpend), new anchor.BN(0))
      .accounts({
        buyer: buyer.publicKey,
        platformConfig: platformConfigPda,
        mint: testMint.publicKey,
        bondingCurve: bondingCurvePda,
        bondingCurveTokenAccount: bondingCurveTokenAccount,
        buyerTokenAccount: buyerTokenAccount,
        feeWallet: feeWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const tokenBalance = await provider.connection.getTokenAccountBalance(buyerTokenAccount);
    const tokensReceived = Number(tokenBalance.value.amount);

    console.log("Bought:", tokensReceived / 1e6, "tokens for 1 SOL");

    // Sell all
    await program.methods
      .sell(new anchor.BN(tokensReceived), new anchor.BN(0))
      .accounts({
        seller: buyer.publicKey,
        platformConfig: platformConfigPda,
        mint: testMint.publicKey,
        bondingCurve: bondingCurvePda,
        bondingCurveTokenAccount: bondingCurveTokenAccount,
        sellerTokenAccount: buyerTokenAccount,
        feeWallet: feeWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const endingSol = await provider.connection.getBalance(buyer.publicKey);

    // Account for transaction fees (2 txs, ~10k lamports each)
    const txFees = 20_000; // rough estimate
    const netChange = endingSol - startingSol + txFees;

    console.log("Ending SOL:", endingSol / LAMPORTS_PER_SOL);
    console.log("Net loss (excluding tx fees):", Math.abs(netChange) / LAMPORTS_PER_SOL, "SOL");
    console.log("Loss as %:", (Math.abs(netChange) / solToSpend * 100).toFixed(2), "%");

    // Should lose ~2% (1% buy fee + 1% sell fee)
    expect(netChange).to.be.lessThan(0);

    const lossPercent = Math.abs(netChange) / solToSpend * 100;
    expect(lossPercent).to.be.greaterThan(1.8); // ~2% loss
    expect(lossPercent).to.be.lessThan(2.2);

    console.log("Round trip loss verified (buy fee + sell fee)");
  });
  // test 5 -- slippage protection buy

  it("Rejects buy if slippage tolerance exceeded", async () => {
    const buyerTokenAccount = await getAssociatedTokenAddress(
      testMint.publicKey,
      payer.publicKey
    );

    const solAmount = 0.1 * LAMPORTS_PER_SOL;
    const impossibleMinTokens = new anchor.BN("999999999999999"); // way more than possible

    console.log("\n=== Slippage Protection Test ===");

    try {
      await program.methods
        .buy(new anchor.BN(solAmount), impossibleMinTokens)
        .accounts({
          buyer: payer.publicKey,
          platformConfig: platformConfigPda,
          mint: testMint.publicKey,
          bondingCurve: bondingCurvePda,
          bondingCurveTokenAccount: bondingCurveTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          feeWallet: feeWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      expect.fail("Should have thrown SlippageExceeded");
    } catch (err:any) {
      expect(err.toString()).to.include("SlippageExceeded");
      console.log("✓ Slippage protection works");
    }
  });

  //test 6 - cont buy graduated tokens
  it("Rejects buy on graduated token", async () => {
    // Create a token and graduate it by buying until threshold
    const graduatedMint = Keypair.generate();

    const [gradMetaPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_meta"), graduatedMint.publicKey.toBuffer()],
      program.programId
    );

    const [gradCurvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), graduatedMint.publicKey.toBuffer()],
      program.programId
    );

    const gradCurveTokenAccount = await getAssociatedTokenAddress(
      graduatedMint.publicKey,
      gradCurvePda,
      true
    );

    // Create token
    await program.methods
      .createToken("Graduated Token", "GRAD", "https://test.com/grad", "Will graduate")
      .accounts({
        creator: payer.publicKey,
        platformConfig: platformConfigPda,
        mint: graduatedMint.publicKey,
        tokenMeta: gradMetaPda,
        bondingCurve: gradCurvePda,
        bondingCurveTokenAccount: gradCurveTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([graduatedMint])
      .rpc();

    console.log("\n=== Graduation Test ===");

    const buyerTokenAccount = await getAssociatedTokenAddress(
      graduatedMint.publicKey,
      payer.publicKey
    );

    // Buy enough to trigger graduation (85 SOL threshold)
    // Keep buying until graduated
    let isGraduated = false;
    let buyCount = 0;

    while (!isGraduated && buyCount < 100) {
      await program.methods
        .buy(new anchor.BN(1 * LAMPORTS_PER_SOL), new anchor.BN(0))
        .accounts({
          buyer: payer.publicKey,
          platformConfig: platformConfigPda,
          mint: graduatedMint.publicKey,
          bondingCurve: gradCurvePda,
          bondingCurveTokenAccount: gradCurveTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          feeWallet: feeWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const curve = await program.account.bondingCurve.fetch(gradCurvePda);
      isGraduated = curve.isGraduated;
      buyCount++;

      if (buyCount % 10 === 0) {
        console.log(`Buy ${buyCount}: ${curve.realSolBalance.toNumber() / LAMPORTS_PER_SOL} SOL raised`);
      }
    }

    console.log(`✓ Token graduated after ${buyCount} buys`);

    // Now try to buy again — should fail
    try {
      await program.methods
        .buy(new anchor.BN(0.1 * LAMPORTS_PER_SOL), new anchor.BN(0))
        .accounts({
          buyer: payer.publicKey,
          platformConfig: platformConfigPda,
          mint: graduatedMint.publicKey,
          bondingCurve: gradCurvePda,
          bondingCurveTokenAccount: gradCurveTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          feeWallet: feeWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      expect.fail("Should have thrown TokenGraduated");
    } catch (err:any) {
      expect(err.toString()).to.include("TokenGraduated");
      console.log("✓ Buy on graduated token correctly rejected");
    }
  });
  //zero amount buy are rejected
  it("Rejects buy with zero SOL amount", async () => {
    const buyerTokenAccount = await getAssociatedTokenAddress(
      testMint.publicKey,
      payer.publicKey
    );

    try {
      await program.methods
        .buy(new anchor.BN(0), new anchor.BN(0))
        .accounts({
          buyer: payer.publicKey,
          platformConfig: platformConfigPda,
          mint: testMint.publicKey,
          bondingCurve: bondingCurvePda,
          bondingCurveTokenAccount: bondingCurveTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          feeWallet: feeWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      expect.fail("Should have thrown ZeroAmount");
    } catch (err:any) {
      expect(err.toString()).to.include("ZeroAmount");
      console.log("✓ Zero amount buy rejected");
    }
  });


});
