import { formatDistanceToNow } from "date-fns";

interface Trade {
  trader: string;
  isBuy: boolean;
  solAmount: string;
  tokenAmount: string;
  timestamp: string;
  signature: string | null;
}

interface TradeHistoryProps {
  trades: Trade[];
}

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_DECIMALS = 1_000_000;

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  if (!trades.length) {
    return (
      <div className="bg-zinc-800 rounded-xl p-8 text-center">
        <p className="text-zinc-500">No trades yet. Be the first to buy!</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>

      <div className="space-y-2">
        {trades.slice(0, 20).map((trade, i) => {
          const solAmount = (parseFloat(trade.solAmount) / LAMPORTS_PER_SOL).toFixed(4);
          const tokenAmount = Math.floor(parseFloat(trade.tokenAmount) / TOKEN_DECIMALS).toLocaleString();
          const timeAgo = formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true });

          return (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`text-xl ${trade.isBuy ? "text-green-400" : "text-red-400"}`}>
                  {trade.isBuy ? "🟢" : "🔴"}
                </span>
                <div>
                  <p className="text-white text-sm">
                    {truncateAddress(trade.trader)}{" "}
                    <span className="text-zinc-400">
                      {trade.isBuy ? "bought" : "sold"}
                    </span>{" "}
                    <span className="font-mono">{tokenAmount}</span>
                    <span className="text-zinc-400"> for </span>
                    <span className="font-mono">{solAmount} SOL</span>
                  </p>
                  <p className="text-xs text-zinc-500">{timeAgo}</p>
                </div>
              </div>

              {trade.signature && (
                <a
                  href={`https://explorer.solana.com/tx/${trade.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-white text-xs"
                >
                  ↗
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}