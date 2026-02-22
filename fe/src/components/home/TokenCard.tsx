import { useEffect, useState } from "react";
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Fetch image from IPFS metadata
  useEffect(() => {
    if (!token.uri) return;

    async function fetchMetadata() {
      try {
        const response = await fetch(token.uri);
        const metadata = await response.json();
        if (metadata.image) {
          setImageUrl(metadata.image);
        }
      } catch (err) {
        console.error("Failed to fetch token metadata:", err);
        setImageError(true);
      }
    }

    fetchMetadata();
  }, [token.uri]);

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
      className="bg-[#141414] rounded-xl p-4 cursor-pointer border border-[#2a2a2a] hover:border-[#3a3a3a] hover:scale-[1.02] transition-all duration-200 hover:shadow-lg hover:shadow-zinc-900/50"
    >
      {/* Header with Image */}
      <div className="flex items-start gap-3 mb-3">
        {/* Token Image with fallback */}
        <div className="w-16 h-16 rounded-xl bg-zinc-800 flex-shrink-0 overflow-hidden">
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={token.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-600 text-zinc-400 text-lg font-bold">
              {token.symbol.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold bg-gradient-to-r from-zinc-300 to-amber-600 bg-clip-text text-transparent truncate">
            {token.name}
          </h3>
          <p className="text-sm text-zinc-500 font-mono">${token.symbol}</p>
        </div>

        {token.isGraduated && (
          <span className="px-2 py-1 rounded-lg bg-amber-600/10 text-amber-600 text-xs font-medium border border-amber-700/20">
            🎓
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <p className="text-zinc-500 text-xs mb-0.5">Price</p>
          <p className="text-amber-600 font-mono text-xs">{price.toFixed(8)} SOL</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs mb-0.5">Market Cap</p>
          <p className="text-zinc-300 font-mono text-xs">{marketCap.toFixed(2)} SOL</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs mb-0.5">Supply</p>
          <p className="text-zinc-300 text-xs">{supply.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs mb-0.5">Creator</p>
          <p className="text-zinc-300 font-mono text-xs">{truncateAddress(token.creator)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-zinc-600 pt-2 border-t border-[#2a2a2a]">
        <span>{timeAgo}</span>
        <span className="text-zinc-500">→</span>
      </div>
    </div>
  );
}