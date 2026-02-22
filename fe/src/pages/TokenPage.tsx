import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { truncateAddress } from "@/utils/solana";
import PriceChart from "@/components/token/PriceChart";
import BuyWidget from "@/components/token/BuyWidget";
import SellWidget from "@/components/token/SellWidget";
import { TradeHistory } from "@/components/token/TradeHistory";
import * as Tabs from "@radix-ui/react-tabs";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const GRADUATION_THRESHOLD = 85; 

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">Loading token...</p>
        </div>
      </div>
    );
  }

  if (!token) return null;

  const progressPercent = Math.min(100, (parseFloat(token.realSolBalance) / 1e9 / GRADUATION_THRESHOLD) * 100);

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm transition-colors duration-200"
          >
            ← Back
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied!");
            }}
            className="text-zinc-500 hover:text-white text-sm transition-colors duration-200"
          >
            Share ↗
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column — Image + Info */}
          <div className="space-y-4">
            {/* Token Image */}
            {metadata?.image && (
              <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                <img
                  src={metadata.image}
                  alt={token.name}
                  className="w-full aspect-square rounded-xl object-cover"
                />
              </div>
            )}

            {/* Token Info */}
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <h1 className="text-xl font-bold text-white mb-1">
                {token.name}{" "}
                <span className="text-zinc-500 font-normal text-base">({token.symbol})</span>
              </h1>
              {metadata?.description && (
                <p className="text-zinc-400 text-sm mb-5 leading-relaxed">{metadata.description}</p>
              )}

              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-500 text-xs uppercase tracking-wide">Creator</span>
                  <span className="text-white font-mono text-xs">{truncateAddress(token.creator)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-500 text-xs uppercase tracking-wide">Market Cap</span>
                  <span className="text-white font-mono text-sm">{token.marketCap?.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-zinc-500 text-xs uppercase tracking-wide">Total Supply</span>
                  <span className="text-white text-sm">{Math.floor(parseFloat(token.totalSupply) / 1e6).toLocaleString()}</span>
                </div>
              </div>

              {/* Graduation Progress */}
              <div className="mt-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-zinc-500">Graduation Progress</span>
                  <span className="text-zinc-400 font-mono">
                    {(parseFloat(token.realSolBalance) / 1e9).toFixed(1)} / {GRADUATION_THRESHOLD} SOL
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-600 mt-1 text-right">{progressPercent.toFixed(1)}%</p>
              </div>

              {token.isGraduated && (
                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-amber-400 text-sm font-medium">Graduated</p>
                  <p className="text-amber-600 text-xs mt-0.5">Trading is now closed</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Columns — Chart + Trade */}
          <div className="lg:col-span-2 space-y-4">
            <PriceChart trades={trades} currentPrice={token.currentPrice} />

            {/* Buy/Sell Tabs */}
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <Tabs.Root defaultValue="buy">
                <Tabs.List className="flex border-b border-zinc-800 mb-5">
                  <Tabs.Trigger
                    value="buy"
                    className="flex-1 py-2.5 text-center text-sm font-medium text-zinc-500 data-[state=active]:text-emerald-500 data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 transition-colors duration-200"
                  >
                    Buy
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="sell"
                    className="flex-1 py-2.5 text-center text-sm font-medium text-zinc-500 data-[state=active]:text-red-500 data-[state=active]:border-b-2 data-[state=active]:border-red-500 transition-colors duration-200"
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
