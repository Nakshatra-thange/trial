import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import type { Token } from "@/types/token";
import { truncateAddress } from "@/utils/solana";

interface TokenCardProps {
  token: Token;
}


const TOKEN_DECIMALS = 1_000_000;

export function TokenCard({ token }: TokenCardProps) {
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Fetch image from IPFS metadata
  useEffect(() => {
   
      if (!token.uri || typeof token.uri !== "string") {
        setImageError(true);
        return;
      }
    
      async function fetchMetadata() {
        try {
          // 🔥 Prevent undefined / bad gateway calls
          if (!token.uri.startsWith("http")) {
            console.warn("Invalid token uri:", token.uri);
            setImageError(true);
            return;
          }
    
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
    
          const response = await fetch(token.uri, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
    
          clearTimeout(timeoutId);
    
          if (!response.ok) {
            console.warn(`Metadata HTTP ${response.status}`);
            setImageError(true);
            return;
          }
    
          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            console.warn("Metadata not JSON:", contentType);
            setImageError(true);
            return;
          }
    
          const metadata = await response.json();
    
          // 🔥 Some IPFS return ipfs://image
          if (metadata?.image) {
            let img = metadata.image;
    
            if (img.startsWith("ipfs://")) {
              img = `https://gateway.pinata.cloud/ipfs/${img.replace("ipfs://", "")}`;
            }
    
            setImageUrl(img);
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            console.warn("Token metadata timeout");
          } else {
            console.warn("Failed metadata:", err);
          }
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
      className="bg-black rounded-xl p-4 cursor-pointer border border-amber-600/20 hover:border-amber-500/50 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg hover:shadow-amber-600/20"
    >
      {/* Header with Image */}
      <div className="flex items-start gap-3 mb-3">
        {/* Token Image with fallback */}
        <div className="w-16 h-16 rounded-xl bg-black border border-amber-600/30 flex-shrink-0 overflow-hidden">
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={token.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-900 to-amber-800 text-amber-400 text-lg font-bold">
              {token.symbol.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate">
            {token.name}
          </h3>
          <p className="text-sm text-gray-500 font-mono">${token.symbol}</p>
        </div>

        {token.isGraduated && (
          <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/50">
            🎓
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Price</p>
          <p className="text-amber-500 font-mono text-xs">{price.toFixed(8)} SOL</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Market Cap</p>
          <p className="text-gray-300 font-mono text-xs">{marketCap.toFixed(2)} SOL</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Supply</p>
          <p className="text-gray-300 text-xs">{supply.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Creator</p>
          <p className="text-gray-300 font-mono text-xs">{truncateAddress(token.creator)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-amber-600/20">
        <span>{timeAgo}</span>
        <span className="text-zinc-500">→</span>
      </div>
    </div>
  );
}
