import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTokens } from "@/hooks/useTokens";
import {TokenCard} from "@/components/home/TokenCard";
import {SearchBar} from "@/components/home/SearchBar";
import {SortTabs} from "@/components/home/SortTabs";
import type { SortOption } from "@/types/token";

export default function HomePage() {
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>("latest");
  const [search, setSearch] = useState("");

  const { tokens, isLoading, error } = useTokens({ sort, search });

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-300 to-amber-700 bg-clip-text text-transparent">SMOOTH</h1>
            <button
              onClick={() => navigate("/create")}
              className="px-6 py-3 rounded-xl bg-amber-600/90 hover:bg-amber-700 text-white font-semibold transition-colors"
            >
              + Create Token
            </button>
          </div>

          <SearchBar onSearch={handleSearch} />
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <SortTabs selected={sort} onChange={setSort} />

        {/* Error State */}
        {error && (
          <div className="mt-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !tokens.length && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-zinc-800 rounded-xl p-4 animate-pulse"
              >
                <div className="flex gap-3 mb-3">
                  <div className="w-16 h-16 rounded-xl bg-zinc-700" />
                  <div className="flex-1">
                    <div className="h-5 bg-zinc-700 rounded mb-2 w-3/4" />
                    <div className="h-4 bg-zinc-700 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-zinc-700 rounded" />
                  <div className="h-4 bg-zinc-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !tokens.length && (
          <div className="mt-20 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold bg-gradient-to-r from-zinc-400 to-amber-700/90 bg-clip-text text-transparent mb-2">
              {search ? "No tokens found" : "No tokens yet"}
            </h3>
            <p className="text-zinc-400 mb-6">
              {search
                ? "Try a different search term"
                : "Be the first to create a token!"}
            </p>
            {!search && (
              <button
                onClick={() => navigate("/create")}
                className="px-6 py-3 rounded-xl bg-amber-600/90 hover:bg-amber-700 text-white font-semibold transition-colors"
              >
                Create Token
              </button>
            )}
          </div>
        )}

        {/* Token Grid */}
        {!isLoading && tokens.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tokens.map((token) => (
              <TokenCard key={token.mint} token={token} />
            ))}
          </div>
        )}

        {/* Auto-refresh indicator */}
        {!isLoading && tokens.length > 0 && (
          <p className="mt-4 text-center text-xs text-zinc-500">
            Auto-refreshing every 10 seconds
          </p>
        )}
      </div>
    </div>
  );
}
