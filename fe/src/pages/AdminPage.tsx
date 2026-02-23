import { useState, useEffect as _useEffect} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface Token {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  createdAt: string;
  hidden: boolean;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [allTokens, setAllTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // Simple password protection (replace with proper auth)
  const ADMIN_PASSWORD = "moonshot2024"; // Change this!

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      fetchAllTokens();
    } else {
      toast.error("Wrong password");
    }
  }

  async function fetchAllTokens() {
    try {
      // Fetch ALL tokens including hidden (requires special admin endpoint)
      const response = await fetch(`${API_URL}/api/tokens/admin/all`);
      const data = await response.json();
      setAllTokens(data.tokens || []);
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
      toast.error("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }

  async function hideToken(mint: string, reason: string) {
    try {
      const response = await fetch(`${API_URL}/api/tokens/hide/${mint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": import.meta.env.VITE_ADMIN_SECRET,
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error("Failed to hide");

      toast.success("Token hidden from homepage");
      fetchAllTokens(); // Refresh list
    } catch (err) {
      toast.error("Failed to hide token");
    }
  }

  async function unhideToken(mint: string) {
    try {
      const response = await fetch(`${API_URL}/api/tokens/unhide/${mint}`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to unhide");

      toast.success("Token restored");
      fetchAllTokens();
    } catch (err) {
      toast.error("Failed to unhide token");
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 rounded-xl p-8 border border-zinc-800">
          <h1 className="text-2xl font-bold text-white mb-6">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-purple-500 text-white font-semibold"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Group tokens by symbol to find duplicates
  const tokensBySymbol = allTokens.reduce((acc, token) => {
    const symbol = token.symbol.toUpperCase();
    if (!acc[symbol]) acc[symbol] = [];
    acc[symbol].push(token);
    return acc;
  }, {} as Record<string, Token[]>);

  const duplicateSymbols = Object.entries(tokensBySymbol).filter(
    ([_, tokens]) => tokens.length > 1
  );

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700"
          >
            ← Back to Home
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <p className="text-zinc-400 text-sm mb-1">Total Tokens</p>
            <p className="text-3xl font-bold text-white">{allTokens.length}</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <p className="text-zinc-400 text-sm mb-1">Hidden</p>
            <p className="text-3xl font-bold text-red-400">
              {allTokens.filter((t) => t.hidden).length}
            </p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <p className="text-zinc-400 text-sm mb-1">Duplicate Symbols</p>
            <p className="text-3xl font-bold text-yellow-400">
              {duplicateSymbols.length}
            </p>
          </div>
        </div>

        {/* Duplicate Tokens Section */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">
            Duplicate Symbols ({duplicateSymbols.length})
          </h2>

          {duplicateSymbols.length === 0 ? (
            <p className="text-zinc-400">No duplicates found 🎉</p>
          ) : (
            <div className="space-y-6">
              {duplicateSymbols.map(([symbol, tokens]) => (
                <div key={symbol} className="border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    ${symbol} ({tokens.length} tokens)
                  </h3>
                  <div className="space-y-2">
                    {tokens.map((token) => (
                      <div
                        key={token.mint}
                        className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-white font-medium">{token.name}</p>
                          <p className="text-xs text-zinc-500 font-mono">
                            {token.mint}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            Created: {new Date(token.createdAt).toLocaleString()}
                          </p>
                        </div>

                        {token.hidden ? (
                          <button
                            onClick={() => unhideToken(token.mint)}
                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm"
                          >
                            Unhide
                          </button>
                        ) : (
                          <button
                            onClick={() => hideToken(token.mint, "duplicate")}
                            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm"
                          >
                            Hide
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Tokens Table */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-xl font-bold text-white mb-4">All Tokens</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-400 text-sm font-medium pb-3">
                    Name
                  </th>
                  <th className="text-left text-zinc-400 text-sm font-medium pb-3">
                    Symbol
                  </th>
                  <th className="text-left text-zinc-400 text-sm font-medium pb-3">
                    Created
                  </th>
                  <th className="text-left text-zinc-400 text-sm font-medium pb-3">
                    Status
                  </th>
                  <th className="text-right text-zinc-400 text-sm font-medium pb-3">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {allTokens.map((token) => (
                  <tr key={token.mint} className="border-b border-zinc-800">
                    <td className="py-3 text-white">{token.name}</td>
                    <td className="py-3 text-white font-mono">${token.symbol}</td>
                    <td className="py-3 text-zinc-400 text-sm">
                      {new Date(token.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      {token.hidden ? (
                        <span className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-xs">
                          Hidden
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs">
                          Visible
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {token.hidden ? (
                        <button
                          onClick={() => unhideToken(token.mint)}
                          className="text-green-400 hover:text-green-300 text-sm"
                        >
                          Unhide
                        </button>
                      ) : (
                        <button
                          onClick={() => hideToken(token.mint, "manual")}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Hide
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

