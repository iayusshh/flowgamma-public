/**
 * useCandles — historical candle loader + live bar updater.
 *
 * Loads historical OHLCV candles from the backend REST API once per
 * symbol/timeframe switch (not on a polling interval). The current bar's
 * close/high/low is updated in real-time via applyTick(), which should be
 * called from useFyersLive's onTick callback.
 *
 * This hook replaces the 1-second /candles/ polling that previously caused
 * 60 full app re-renders per minute.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/$/, '');

// Resolution string used by the backend candle endpoint
const TF_TO_RESOLUTION = { d: 'd', '60': '60', '15': '15', '5': '5', '3': '3', '1': '1' };

export function useCandles(symbol, timeframe) {
  const [candles, setCandles]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const candlesRef              = useRef([]);    // shadow ref for tick updates (avoids stale closure)

  const resolution = TF_TO_RESOLUTION[timeframe] || '15';

  // Load historical candles once per symbol + timeframe change
  useEffect(() => {
    setLoading(true);
    const enc = encodeURIComponent(symbol);
    fetch(`${API_BASE}/candles/${enc}?resolution=${resolution}`)
      .then(r => r.ok ? r.json() : { candles: [] })
      .then(d => {
        const bars = d.candles || [];
        candlesRef.current = bars;
        setCandles(bars);
      })
      .catch(() => {
        // Keep previous candles on network failure (stale-while-revalidate)
      })
      .finally(() => setLoading(false));
  }, [symbol, resolution]);

  /**
   * Apply a live FYERS tick to the current (last) candle bar.
   * Should be called from useFyersLive's onTick for the active symbol.
   * Does NOT trigger a re-fetch — mutates only the last bar in-place.
   *
   * @param {{ ltp: number, high: number, low: number }} tick
   */
  const applyTick = useCallback((tick) => {
    setCandles(prev => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];

      // Determine current values regardless of candle format ({ts,open,...} or [ts,o,h,l,c,v])
      const isArr = Array.isArray(last);
      const curHigh  = isArr ? last[2] : last.high;
      const curLow   = isArr ? last[3] : last.low;
      const newHigh  = Math.max(curHigh, tick.ltp);
      const newLow   = Math.min(curLow,  tick.ltp);

      // Only update if something actually changed (avoid unnecessary renders)
      if (tick.ltp === (isArr ? last[4] : last.close) && newHigh === curHigh && newLow === curLow) {
        return prev;
      }

      const updated = isArr
        ? [last[0], last[1], newHigh, newLow, tick.ltp, last[5]]
        : { ...last, high: newHigh, low: newLow, close: tick.ltp };

      candlesRef.current = [...prev.slice(0, -1), updated];
      return candlesRef.current;
    });
  }, []);

  /**
   * Force a fresh candle load (called after SSE snapshot_ready notification).
   */
  const reloadCandles = useCallback(() => {
    const enc = encodeURIComponent(symbol);
    fetch(`${API_BASE}/candles/${enc}?resolution=${resolution}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const bars = d.candles || [];
        candlesRef.current = bars;
        setCandles(bars);
      })
      .catch(() => {});
  }, [symbol, resolution]);

  return { candles, loading, applyTick, reloadCandles };
}
