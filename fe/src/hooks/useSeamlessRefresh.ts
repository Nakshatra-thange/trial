import { useState, useEffect, useRef, useCallback } from "react";

interface UseSeamlessRefreshOptions<T> {
  fetcher: () => Promise<T>;
  interval: number; // milliseconds
  enabled?: boolean;
}

export function useSeamlessRefresh<T>({
  fetcher,
  interval,
  enabled = true,
}: UseSeamlessRefreshOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const previousDataRef = useRef<T | null>(null);
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async (isInitial = false) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;

    try {
      const newData = await fetcher();
      
      // Only update if data actually changed (deep equality check for simple objects)
      const dataChanged = JSON.stringify(newData) !== JSON.stringify(previousDataRef.current);
      
      if (dataChanged || isInitial) {
        setData(newData);
        previousDataRef.current = newData;
      }
      
      setError(null);
      
      if (isInitial) {
        setIsInitialLoading(false);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch");
      
      if (isInitial) {
        setIsInitialLoading(false);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [fetcher]);

  // Initial fetch
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Interval refresh
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      fetchData(false);
    }, interval);

    return () => clearInterval(intervalId);
  }, [enabled, interval, fetchData]);

  return {
    data,
    isInitialLoading,
    error,
    refetch: () => fetchData(false),
  };
}