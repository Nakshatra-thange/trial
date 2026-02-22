import { useState, useEffect } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { toast } from "sonner";
import { sellTokens } from "@/services/tradingService";
import { calculateSolOut, deductFee, applySlippage } from "@/utils/bondingCurve";

interface SellWidgetProps {
  mint: string;
  virtualSol: string;
  virtualToken: string;
  isGraduated: boolean;
  onSuccess: () => void;
}

const TOKEN_DECIMALS = 1_000_000;

export default function SellWidget({ mint, virtualSol, virtualToken, isGraduated, onSuccess }: SellWidgetProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [tokenInput, setTokenInput] = useState("");
  const [solOut, setSolOut] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [userTokenBalance, setUserTokenBalance] = useState(0);

  // Fetch user token balance
  useEffect(() => {
    if (!wallet) return;

    (async () => {
      try {
        const tokenAccount = await getAssociatedTokenAddress(
          new PublicKey(mint),
          wallet.publicKey
        );

        const accountInfo = await getAccount(connection, tokenAccount);
        setUserTokenBalance(Number(accountInfo.amount) / TOKEN_DECIMALS);
      } catch {
        setUserTokenBalance(0);
      }
    })();
  }, [wallet, connection, mint]);

  // Calculate SOL out when token input changes
  useEffect(() => {
    if (!tokenInput || parseFloat(tokenInput) <= 0) {
      setSolOut(0);
      return;
    }

    const tokensBase = parseFloat(tokenInput) * TOKEN_DECIMALS;

    const solBeforeFee = calculateSolOut(
      parseFloat(virtualSol),
      parseFloat(virtualToken),
      tokensBase
    );

    const [solAfterFee] = deductFee(solBeforeFee);
    setSolOut(solAfterFee / LAMPORTS_PER_SOL);
  }, [tokenInput, virtualSol, virtualToken]);

  async function handleSell() {
    if (!wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    if (isGraduated) {
      toast.error("Token has graduated — trading is closed");
      return;
    }

    const tokenAmount = parseFloat(tokenInput);
    if (!tokenAmount || tokenAmount <= 0) {
      toast.error("Enter a valid token amount");
      return;
    }

    if (tokenAmount > userTokenBalance) {
      toast.error("Insufficient token balance");
      return;
    }

    setIsLoading(true);

    try {
      const tokensBase = Math.floor(tokenAmount * TOKEN_DECIMALS);

      const expectedSol = calculateSolOut(
        parseFloat(virtualSol),
        parseFloat(virtualToken),
        tokensBase
      );

      const [solAfterFee] = deductFee(expectedSol);
      const minSolOut = applySlippage(solAfterFee, 100); // 1% slippage

      const signature = await await sellTokens(
        connection,
        wallet.publicKey,
        wallet.signTransaction,
        new PublicKey(mint),
        BigInt(tokensBase),
        BigInt(Math.floor(minSolOut))
      );

      await connection.confirmTransaction(signature, "confirmed");

      toast.success("Sell successful!");
      setTokenInput("");
      onSuccess(); // Refresh token data

    } catch (err: any) {
      console.error("Sell error:", err);

      if (err.message?.includes("User rejected")) {
        toast.error("Transaction cancelled");
      } else if (err.message?.includes("SlippageExceeded")) {
        toast.error("Price moved too much — try again");
      } else {
        toast.error("Sell failed: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  function setMaxTokens() {
    setTokenInput(userTokenBalance.toFixed(2));
  }

  return (
    <div className="space-y-4">
      {/* Token Input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-zinc-500 uppercase tracking-wide">You sell (tokens)</label>
          <span className="text-xs text-zinc-600 font-mono">
            {userTokenBalance.toLocaleString()} tokens
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="0"
            step="1"
            className="flex-1 px-4 py-3 rounded-xl bg-black border border-zinc-700 text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors duration-200 font-mono"
            disabled={isLoading || isGraduated}
          />
          <button
            onClick={setMaxTokens}
            className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-medium transition-colors duration-200 disabled:opacity-40"
            disabled={isLoading || isGraduated}
          >
            MAX
          </button>
        </div>
      </div>

      {/* SOL Out */}
      <div>
        <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">You receive (SOL)</label>
        <div className="px-4 py-3 rounded-xl bg-black border border-zinc-700">
          <p className="text-white font-mono text-sm">
            {solOut > 0 ? solOut.toFixed(6) : "0"}
          </p>
        </div>
      </div>

      {/* Sell Button */}
      <button
        onClick={handleSell}
        disabled={isLoading || !tokenInput || parseFloat(tokenInput) <= 0 || isGraduated}
        className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-semibold transition-colors duration-200"
      >
        {isLoading ? "Selling..." : isGraduated ? "Trading Closed" : "Sell Now"}
      </button>

      {solOut > 0 && (
        <p className="text-xs text-zinc-600 text-center">
          After 1% platform fee + ~0.000005 SOL network fee
        </p>
      )}
    </div>
  );
}
