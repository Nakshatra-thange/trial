import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import type { Token } from "@/types/token";
import { truncateAddress } from "@/utils/solana";

interface TokenCardProps {
  token: Token;
}

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_DECIMALS = 1_000_000;

export function TokenCard({ token }: TokenCardProps) {
  const navigate = useNavigate();

  const price = token.currentPrice || 0;
  const marketCap = token.marketCap || 0;
  const supply = Math.floor(parseFloat(token.totalSupply) / TOKEN_DECIMALS);
  const timeAgo = formatDistanceToNow(new Date(token.createdAt), { addSuffix: true });

  function handleClick() {
    navigate(`/token/${token.mint}`);
  }

  return (
    <div
      onClick={handleClick}
      className="bg-zinc-800 rounded-xl p-4 hover:bg-zinc-700 transition-colors cursor-pointer border border-zinc-700 hover:border-zinc-600"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Token image placeholder */}
        <div className="w-16 h-16 rounded-xl bg-zinc-700 flex-shrink-0 flex items-center justify-center text-2xl">
          {token.symbol.slice(0, 2)}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">
            {token.name}
          </h3>
          <p className="text-sm text-zinc-400 font-mono">${token.symbol}</p>
        </div>

        {token.isGraduated && (
          <span className="px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-medium">
            🎓 Graduated
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <p className="text-zinc-500 text-xs">Price</p>
          <p className="text-white font-mono">{price.toFixed(8)} SOL</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs">Market Cap</p>
          <p className="text-white font-mono">{marketCap.toFixed(2)} SOL</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs">Supply</p>
          <p className="text-white">{supply.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs">Creator</p>
          <p className="text-white font-mono text-xs">{truncateAddress(token.creator)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{timeAgo}</span>
        <span>→</span>
      </div>
    </div>
  );
}
