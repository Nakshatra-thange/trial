import { useState, useEffect } from "react";
import type { Token, SortOption } from "@/types/token";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface UseTokensOptions {
  sort?: SortOption;
  search?: string;
  limit?: number;
}

interface UseTokensResult {
  tokens: Token[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTokens(options: UseTokensOptions = {}): UseTokensResult {
  const { sort = "latest", search = "", limit = 50 } = options;

  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTokens() {
    try {
      setIsLoading(true);
      setError(null);

      let url = `${API_URL}/api/tokens?sort=${sort}&limit=${limit}`;

      if (search) {
        url = `${API_URL}/api/tokens/search?q=${encodeURIComponent(search)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch tokens: ${response.statusText}`);
      }

      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (err) {
      console.error("Error fetching tokens:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch tokens");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTokens();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchTokens, 10_000);

    return () => clearInterval(interval);
  }, [sort, search, limit]);

  return {
    tokens,
    isLoading,
    error,
    refetch: fetchTokens,
  };
}