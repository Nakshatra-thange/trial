import { useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { uploadTokenMetadata } from "../services/ipfs";
import { createToken } from "../services/tokenService";

export type CreateTokenStep = "idle" | "uploading" | "signing" | "confirming" | "success" | "error";

export function useCreateToken() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [step, setStep] = useState<CreateTokenStep>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [mintAddress, setMintAddress] = useState<string | null>(null);

  async function create(
    name: string,
    symbol: string,
    description: string,
    imageFile: File
  ): Promise<string | null> {
    if (!wallet) {
      setError("Wallet not connected");
      setStep("error");
      return null;
    }
    console.log("wallet:", wallet);
    try {
      // Step 1: Upload to IPFS
      setStep("uploading");
      setProgress("Uploading image to IPFS...");

      const metadataUri = await uploadTokenMetadata(name, symbol, description, imageFile);

      setProgress("Image uploaded! Creating token...");

      // Step 2: Call Solana program
      setStep("signing");
      setProgress("Check your wallet to approve the transaction...");
      console.log("METADATA URI:", metadataUri);

      const { signature, mint } = await createToken(
        wallet,
        connection,
        name,
        symbol,
        metadataUri,
        description
      );
      console.log("TX SIGNATURE:", signature);
      console.log("MINT:", mint.toBase58());

      // Step 3: Wait for confirmation
      setStep("confirming");
      setProgress("Transaction submitted! Waiting for confirmation...");

      await connection.confirmTransaction(signature, "confirmed");

      // Success!
      setStep("success");
      setMintAddress(mint.toBase58());
      setProgress("Token created successfully!");

      return mint.toBase58();
      
    } catch (err: any) {
      console.error("Token creation error:", err);
      setStep("error");

      if (err.message?.includes("User rejected")) {
        setError("You rejected the transaction in your wallet");
      } else if (err.message?.includes("IPFS")) {
        setError("Failed to upload to IPFS. Please try again.");
      } else {
        setError(err.message || "Failed to create token. Please try again.");
      }

      return null;
    }
  }

  function reset() {
    setStep("idle");
    setProgress("");
    setError("");
    setMintAddress(null);
  }

  return {
    create,
    reset,
    step,
    progress,
    error,
    mintAddress,
    isLoading: ["uploading", "signing", "confirming"].includes(step),
  };
}