import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { truncateAddress } from "@/utils/solana";
import PriceChart from "@/components/token/PriceChart";
import BuyWidget from "@/components/token/BuyWidget";
import SellWidget from "@/components/token/SellWidget";
import {TradeHistory} from "@/components/token/TradeHistory";
import * as Tabs from "@radix-ui/react-tabs";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const GRADUATION_THRESHOLD = 85; // SOL

export function TokenPage() {
  const { mint } = useParams<{ mint: string }>();
  const navigate = useNavigate();

  const [token, setToken] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (mint) {
      fetchTokenData();
      const interval = setInterval(fetchTokenData, 10_000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [mint]);

  async function fetchTokenData() {
    try {
      // Fetch token from backend
      const tokenRes = await fetch(`${API_URL}/api/tokens/${mint}`);
      if (!tokenRes.ok) throw new Error("Token not found");
      const tokenData = await tokenRes.json();
      setToken(tokenData.token);

      // Fetch metadata from IPFS
      if (tokenData.token.uri) {
        const metaRes = await fetch(tokenData.token.uri);
        const metaData = await metaRes.json();
        setMetadata(metaData);
      }

      // Fetch trades
      const tradesRes = await fetch(`${API_URL}/api/tokens/${mint}/trades`);
      const tradesData = await tradesRes.json();
      setTrades(tradesData.trades);

      setIsLoading(false);
    } catch (err) {
      console.error("Failed to fetch token:", err);
      toast.error("Token not found");
      return;
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading token...</p>
        </div>
      </div>
    );
  }

  if (!token) return null;

  const progressPercent = Math.min(100, (parseFloat(token.realSolBalance) / 1e9 / GRADUATION_THRESHOLD) * 100);

  return (
    <div className="min-h-screen bg-zinc-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/")}
            className="text-zinc-400 hover:text-white"
          >
            ← Back
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied!");
            }}
            className="text-zinc-400 hover:text-white"
          >
            Share ↗
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column — Image + Info */}
          <div className="space-y-6">
            {/* Token Image */}
            {metadata?.image && (
              <div className="bg-zinc-800 rounded-xl p-4">
                <img
                  src={metadata.image}
                  alt={token.name}
                  className="w-full aspect-square rounded-xl object-cover"
                />
              </div>
            )}

            {/* Token Info */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <h1 className="text-2xl font-bold text-white mb-1">
                {token.name} ({token.symbol})
              </h1>
              {metadata?.description && (
                <p className="text-zinc-400 text-sm mb-4">{metadata.description}</p>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Creator</span>
                  <span className="text-white font-mono">{truncateAddress(token.creator)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Market Cap</span>
                  <span className="text-white">{token.marketCap?.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Supply</span>
                  <span className="text-white">{Math.floor(parseFloat(token.totalSupply) / 1e6).toLocaleString()}</span>
                </div>
              </div>

              {/* Graduation Progress */}
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-400">Graduation Progress</span>
                  <span className="text-zinc-400">
                    {(parseFloat(token.realSolBalance) / 1e9).toFixed(1)} / {GRADUATION_THRESHOLD} SOL
                  </span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {token.isGraduated && (
                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-yellow-400 text-sm font-medium">🎓 Graduated!</p>
                  <p className="text-yellow-500/70 text-xs mt-1">Trading is now closed</p>
                </div>
              )}
            </div>
          </div>

          {/* Middle Column — Chart */}
          <div className="lg:col-span-2 space-y-6">
            <PriceChart trades={trades} currentPrice={token.currentPrice} />

            {/* Buy/Sell Tabs */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <Tabs.Root defaultValue="buy">
                <Tabs.List className="flex border-b border-zinc-700 mb-6">
                  <Tabs.Trigger
                    value="buy"
                    className="flex-1 py-3 text-center text-zinc-400 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 transition-colors"
                  >
                    Buy
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="sell"
                    className="flex-1 py-3 text-center text-zinc-400 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-500 transition-colors"
                  >
                    Sell
                  </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="buy">
                  <BuyWidget
                    mint={mint!}
                    virtualSol={token.virtualSol}
                    virtualToken={token.virtualToken}
                    isGraduated={token.isGraduated}
                    onSuccess={fetchTokenData}
                  />
                </Tabs.Content>

                <Tabs.Content value="sell">
                  <SellWidget
                    mint={mint!}
                    virtualSol={token.virtualSol}
                    virtualToken={token.virtualToken}
                    isGraduated={token.isGraduated}
                    onSuccess={fetchTokenData}
                  />
                </Tabs.Content>
              </Tabs.Root>
            </div>

            {/* Trade History */}
            <TradeHistory trades={trades} />
          </div>
        </div>
      </div>
    </div>
  );
}