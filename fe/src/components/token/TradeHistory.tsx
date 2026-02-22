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
      <div className="bg-zinc-900 rounded-xl p-8 text-center border border-zinc-800">
        <p className="text-zinc-600 text-sm">No trades yet. Be the first to buy!</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Recent Trades</h3>
      </div>

      <div className="divide-y divide-zinc-800">
        {trades.slice(0, 20).map((trade, i) => {
          const solAmount = (parseFloat(trade.solAmount) / LAMPORTS_PER_SOL).toFixed(4);
          const tokenAmount = Math.floor(parseFloat(trade.tokenAmount) / TOKEN_DECIMALS).toLocaleString();
          const timeAgo = formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true });

          return (
            <div
              key={i}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/50 transition-colors duration-200"
            >
              <div className="flex items-center gap-3">
                {/* Buy/Sell dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${trade.isBuy ? "bg-emerald-500" : "bg-red-500"}`} />
                <div>
                  <p className="text-white text-sm">
                    <span className="text-zinc-400 font-mono text-xs">{truncateAddress(trade.trader)}</span>
                    <span className={`mx-1.5 text-xs font-medium ${trade.isBuy ? "text-emerald-500" : "text-red-500"}`}>
                      {trade.isBuy ? "bought" : "sold"}
                    </span>
                    <span className="font-mono text-xs text-zinc-300">{tokenAmount}</span>
                    <span className="text-zinc-600 text-xs mx-1">for</span>
                    <span className="font-mono text-xs text-zinc-300">{solAmount} SOL</span>
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">{timeAgo}</p>
                </div>
              </div>

              {trade.signature && (
                <a
                  href={`https://explorer.solana.com/tx/${trade.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 hover:text-blue-400 text-xs transition-colors duration-200 ml-3 flex-shrink-0"
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
