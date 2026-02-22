import { useCallback } from "react";
import type { Token, SortOption } from "@/types/token";
import { useSeamlessRefresh } from "./useSeamlessRefresh";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface UseTokensOptions {
  sort?: SortOption;
  search?: string;
  limit?: number;
}

export function useTokens(options: UseTokensOptions = {}) {
  const { sort = "latest", search = "", limit = 50 } = options;

  const fetcher = useCallback(async () => {
    let url = `${API_URL}/api/tokens?sort=${sort}&limit=${limit}`;

    if (search) {
      url = `${API_URL}/api/tokens/search?q=${encodeURIComponent(search)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tokens || [];
  }, [sort, search, limit]);

  const { data, isInitialLoading, error, refetch } = useSeamlessRefresh<Token[]>({
    fetcher,
    interval: 10_000, // 10 seconds
    enabled: true,
  });

  return {
    tokens: data || [],
    isLoading: isInitialLoading,
    error,
    refetch,
  };
}