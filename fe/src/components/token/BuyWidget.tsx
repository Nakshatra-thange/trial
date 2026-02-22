import { useState, useEffect } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { toast } from "sonner";
import { buyTokens } from "@/services/tradingService";
import { calculateTokensOut, deductFee, applySlippage } from "@/utils/bondingCurve";

interface BuyWidgetProps {
  mint: string;
  virtualSol: string;
  virtualToken: string;
  isGraduated: boolean;
  onSuccess: () => void;
}

const TOKEN_DECIMALS = 1_000_000;

export default function BuyWidget({ mint, virtualSol, virtualToken, isGraduated, onSuccess }: BuyWidgetProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [solInput, setSolInput] = useState("");
  const [tokensOut, setTokensOut] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [userSolBalance, setUserSolBalance] = useState(0);

  // Fetch user SOL balance
  useEffect(() => {
    if (!wallet) return;
    connection.getBalance(wallet.publicKey).then(balance => {
      setUserSolBalance(balance / LAMPORTS_PER_SOL);
    });
  }, [wallet, connection]);

  // Calculate tokens out when SOL input changes
  useEffect(() => {
    if (!solInput || parseFloat(solInput) <= 0) {
      setTokensOut(0);
      return;
    }

    const solLamports = parseFloat(solInput) * LAMPORTS_PER_SOL;
    const [solAfterFee] = deductFee(solLamports);

    const tokens = calculateTokensOut(
      parseFloat(virtualSol),
      parseFloat(virtualToken),
      solAfterFee
    );

    setTokensOut(tokens / TOKEN_DECIMALS);
  }, [solInput, virtualSol, virtualToken]);

  async function handleBuy() {
    if (!wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    if (isGraduated) {
      toast.error("Token has graduated — trading is closed");
      return;
    }

    const solAmount = parseFloat(solInput);
    if (!solAmount || solAmount <= 0) {
      toast.error("Enter a valid SOL amount");
      return;
    }

    if (solAmount > userSolBalance) {
      toast.error("Insufficient SOL balance");
      return;
    }

    setIsLoading(true);

    try {
      const solLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const [solAfterFee] = deductFee(solLamports);

      const expectedTokens = calculateTokensOut(
        parseFloat(virtualSol),
        parseFloat(virtualToken),
        solAfterFee
      );

      const minTokensOut = applySlippage(expectedTokens, 100); // 1% slippage

      const signature = await buyTokens(
        connection,
        wallet.publicKey,
        wallet.signTransaction,
        new PublicKey(mint),
        BigInt(solLamports),
        BigInt(Math.floor(minTokensOut))
      );

      await connection.confirmTransaction(signature, "confirmed");

      toast.success("Buy successful!");
      setSolInput("");
      onSuccess(); // Refresh token data

    } catch (err: any) {
      console.error("Buy error:", err);

      if (err.message?.includes("User rejected")) {
        toast.error("Transaction cancelled");
      } else if (err.message?.includes("SlippageExceeded")) {
        toast.error("Price moved too much — try again");
      } else {
        toast.error("Buy failed: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  console.log("input:", solInput)
  console.log("calc:", tokensOut)

  function setMaxSol() {
    // Reserve 0.01 SOL for fees
    const maxSol = Math.max(0, userSolBalance - 0.01);
    setSolInput(maxSol.toFixed(4));
  }

  return (
    <div className="space-y-4">
      {/* SOL Input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-zinc-500 uppercase tracking-wide">You pay (SOL)</label>
          <span className="text-xs text-zinc-600 font-mono">
            {userSolBalance.toFixed(4)} SOL
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={solInput}
            onChange={(e) => setSolInput(e.target.value)}
            placeholder="0.0"
            step="0.001"
            className="flex-1 px-4 py-3 rounded-xl bg-black border border-zinc-700 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors duration-200 font-mono"
            disabled={isLoading || isGraduated}
          />
          <button
            onClick={setMaxSol}
            className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-medium transition-colors duration-200 disabled:opacity-40"
            disabled={isLoading || isGraduated}
          >
            MAX
          </button>
        </div>
      </div>

      {/* Tokens Out */}
      <div>
        <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">You receive (tokens)</label>
        <div className="px-4 py-3 rounded-xl bg-black border border-zinc-700">
          <p className="text-white font-mono text-sm">
            {tokensOut > 0 ? tokensOut.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"}
          </p>
        </div>
      </div>

      {/* Buy Button */}
      <button
        onClick={handleBuy}
        disabled={isLoading || !solInput || parseFloat(solInput) <= 0 || isGraduated}
        className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-semibold transition-colors duration-200"
      >
        {isLoading ? "Buying..." : isGraduated ? "Trading Closed" : "Buy Now"}
      </button>

      {tokensOut > 0 && (
        <p className="text-xs text-zinc-600 text-center">
          Includes 1% platform fee + ~0.000005 SOL network fee
        </p>
      )}
    </div>
  );
}
