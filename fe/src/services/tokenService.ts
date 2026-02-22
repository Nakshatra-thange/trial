import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";

import { Program, AnchorProvider, setProvider, type Idl } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import idl from "../idl/smooth.json?raw";
const parsedIdl = JSON.parse(idl);// Your program IDL


const PRO_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);
const PROGRAM_ID = PRO_ID
console.log("PROGRAM_ID:", PROGRAM_ID.toBase58());

export async function createToken(
  wallet: any, // Anchor wallet
  connection: any,
  name: string,
  symbol: string,
  uri: string,
  description: string
): Promise<{ signature: string; mint: PublicKey }> {
  const provider = new AnchorProvider(
    connection,
    wallet as any,
    { commitment: "confirmed" }
  );
  setProvider(provider);

  const program = new Program(
    parsedIdl as any,
    
    
    provider
  ) as Program<Idl>

  // Generate new mint keypair
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  // Derive PDAs
  const [platformConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform_config")],
    PROGRAM_ID
  );

  const [tokenMetaPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_meta"), mint.toBuffer()],
    PROGRAM_ID
  );

  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    PROGRAM_ID
  );

  const bondingCurveTokenAccount = await getAssociatedTokenAddress(
    mint,
    bondingCurvePda,
    true // allowOwnerOffCurve
  );
  console.log("program methods:", program.methods);

  // Call create_token instruction
  const signature = await program.methods
    .createToken(name, symbol, uri, description)
    .accounts({
      creator: wallet.publicKey,
      platformConfig: platformConfigPda,
      mint: mint,
      tokenMeta: tokenMetaPda,
      bondingCurve: bondingCurvePda,
      bondingCurveTokenAccount: bondingCurveTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
    })
    .signers([mintKeypair])
    .rpc();

  return { signature, mint };
}