import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTokens } from "@/hooks/useTokens";
import {TokenCard} from "@/components/home/TokenCard";
import {SearchBar} from "@/components/home/SearchBar";
import {SortTabs} from "@/components/home/SortTabs";
import type { SortOption } from "@/types/token";
import "../styles/moonshot.css";

export default function HomePage() {
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>("latest");
  const [search, setSearch] = useState("");
  const [stars, setStars] = useState<Array<{x: number; y: number; size: number; delay: number}>>([]);

  const { tokens, isLoading, error } = useTokens({ sort, search });

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
  }, []);

  // Generate random stars
  useEffect(() => {
    const generatedStars = Array.from({ length: 200 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      delay: Math.random() * 3
    }));
    setStars(generatedStars);
  }, []);

  return (
    <div className="min-h-screen bg-space-sky">
      {/* Starfield Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {stars.map((star, idx) => (
          <div
            key={idx}
            className="absolute rounded-full bg-white animate-star-twinkle"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              opacity: 0.6
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="border-b border-amber-600/20 bg-black/40 backdrop-blur-sm sticky top-0 z-20 relative">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F376f2aa16ff54ceba60319d320e8f8cd%2F490f1223247041df813d7d673c54e563?format=webp&width=200&height=200"
              alt="Moonshot"
              className="h-16 w-auto"
            />
            <button
              onClick={() => navigate("/create")}
              className="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-black font-semibold transition-colors text-sm"
            >
              + Create Token
            </button>
          </div>

          <SearchBar onSearch={handleSearch} />
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section relative min-h-screen flex items-center justify-center py-24 overflow-hidden">
        {/* Moon */}
        <div className="absolute -right-40 top-20 moon-glow">
          <div className="w-96 h-96 rounded-full bg-amber-600 blur-2xl opacity-20" />
        </div>

        {/* Main Content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
          {/* Title */}
          <h2 className="moonshot-title text-7xl lg:text-8xl font-black text-white mb-4 drop-shadow-2xl">
            MOONSHOT
          </h2>

          {/* Subslogan */}
          <p className="moonshot-subtitle text-2xl lg:text-3xl text-amber-500 font-light tracking-widest mb-16 drop-shadow-lg">
            Launch Your Token To The Moon
          </p>

          {/* Rocket Animation */}
          <div className="relative h-32 flex items-center justify-center mb-16">
            <svg className="rocket-moving w-16 h-32 drop-shadow-xl" viewBox="0 0 100 160" fill="none">
              <defs>
                <linearGradient id="rocketGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{ stopColor: '#000000', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#FDB913', stopOpacity: 1 }} />
                </linearGradient>
              </defs>

              {/* Rocket Body */}
              <rect x="35" y="20" width="30" height="80" rx="5" fill="url(#rocketGradient)" stroke="#FDB913" strokeWidth="1.5"/>

              {/* Nose Cone */}
              <polygon points="50,10 65,25 35,25" fill="#FDB913" stroke="#FDB913" strokeWidth="1"/>

              {/* Window */}
              <circle cx="50" cy="30" r="4" fill="#000000"/>

              {/* Left Fin */}
              <polygon points="35,95 20,130 35,115" fill="#FDB913" stroke="#FDB913" strokeWidth="1"/>

              {/* Right Fin */}
              <polygon points="65,95 80,130 65,115" fill="#FDB913" stroke="#FDB913" strokeWidth="1"/>

              {/* Flame */}
              <g className="animate-flame-big">
                <polygon points="40,140 45,160 50,140" fill="#FDB913" opacity="0.9"/>
                <polygon points="50,140 55,162 60,140" fill="#FDB913" opacity="0.7"/>
              </g>
            </svg>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => {
              const tokensSection = document.getElementById('tokens-section');
              tokensSection?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded-lg transition-all hover:scale-105 drop-shadow-lg text-lg"
          >
            Explore Tokens
          </button>
        </div>
      </section>

      {/* Tokens Section */}
      <div id="tokens-section" className="relative z-10 bg-black/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-12">
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
                  className="bg-gray-900 rounded-xl p-4 animate-pulse border border-amber-600/20"
                >
                  <div className="flex gap-3 mb-3">
                    <div className="w-16 h-16 rounded-xl bg-gray-800" />
                    <div className="flex-1">
                      <div className="h-5 bg-gray-800 rounded mb-2 w-3/4" />
                      <div className="h-4 bg-gray-800 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-800 rounded" />
                    <div className="h-4 bg-gray-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !tokens.length && (
            <div className="mt-20 text-center">
              <div className="w-20 h-20 rounded-full bg-amber-600/20 border border-amber-500/50 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-amber-500"
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
              <h3 className="text-xl font-semibold text-amber-500 mb-2">
                {search ? "No tokens found" : "No tokens yet"}
              </h3>
              <p className="text-gray-400 mb-6">
                {search
                  ? "Try a different search term"
                  : "Be the first to create a token!"}
              </p>
              {!search && (
                <button
                  onClick={() => navigate("/create")}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold transition-colors"
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
            <p className="mt-4 text-center text-xs text-gray-500">
              Auto-refreshing every 10 seconds
            </p>
          )}

          {/* Coming Soon Text */}
          <div className="mt-20 pb-20 text-center">
            <p className="text-xl font-bold text-amber-600/80">Soon launching on mainnet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
