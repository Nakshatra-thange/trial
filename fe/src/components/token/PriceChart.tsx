import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  LineSeries,
  type UTCTimestamp,
} from "lightweight-charts";

interface Trade {
  timestamp: string;
  priceAtTrade: string;
  solAmount: string;
  tokenAmount: string;
  isBuy: boolean;
}

interface PriceChartProps {
  trades: Trade[];
  currentPrice: number;
}

export default function PriceChart({ trades, currentPrice }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  /**
   * Chart initialization
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: "#0a0a0a" },
        textColor: "#6b6b6b",
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#2a2a2a",
      },
    });

    /**
     * lightweight-charts v5 syntax
     */
    const lineSeries = chart.addSeries(LineSeries, {
      color: "#10b981",
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = lineSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.resize(chartContainerRef.current.clientWidth, 400);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  /**
   * Update chart data when trades change
   */
  useEffect(() => {
    if (!seriesRef.current) return;

    if (!trades.length) {
      seriesRef.current.setData([]);
      return;
    }

    const chartData: LineData<UTCTimestamp>[] = trades
      .map((trade) => {
        const time = Math.floor(
          new Date(trade.timestamp).getTime() / 1000
        ) as UTCTimestamp;

        return {
          time,
          value: Number(trade.priceAtTrade),
        };
      })
      .sort((a, b) => Number(a.time) - Number(b.time));

    seriesRef.current.setData(chartData);
  }, [trades]);

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Price Chart</h3>
        <div className="text-xl font-bold text-emerald-400 font-mono">
          {currentPrice.toFixed(8)} SOL
        </div>
      </div>

      <div ref={chartContainerRef} />
    </div>
  );
}
