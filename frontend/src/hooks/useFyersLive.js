/**
 * useFyersLive — live quote polling via backend /quote/ endpoint.
 *
 * Originally intended to use FYERS Web SDK WebSocket, but the SDK v3
 * (cdn.fyers.in) does not expose a browser market-data feed — only
 * REST auth helpers and order-notification sockets.
 *
 * This implementation polls the active symbol at 2-second intervals,
 * keeping the same onTick interface so App.jsx is unchanged.
 * Watchlist LTPs continue to be served by WatchlistPanel's own polling.
 */

import { useEffect, useRef } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/$/, '');
const POLL_MS  = 2000;

export function useFyersLive(symbols, onTick) {
  const onTickRef    = useRef(onTick);
  const timerRef     = useRef(null);
  const symbolsRef   = useRef(symbols);

  // Keep refs current without re-triggering the effect
  onTickRef.current  = onTick;
  symbolsRef.current = symbols;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const syms = symbolsRef.current;
      if (!syms?.length) return;

      // Poll only the active symbol (first in list) to keep requests minimal.
      // Watchlist symbols get their LTPs from WatchlistPanel's summary poll.
      const sym = syms[0];
      try {
        const res = await fetch(`${API_BASE}/quote/${encodeURIComponent(sym)}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled || !d?.ltp) return;

        onTickRef.current?.({
          symbol:    sym,
          ltp:       d.ltp,
          open:      d.open  ?? d.ltp,
          high:      d.high  ?? d.ltp,
          low:       d.low   ?? d.ltp,
          prevClose: d.prev_close ?? d.ltp,
          volume:    d.volume ?? 0,
          changePct: d.prev_close ? ((d.ltp - d.prev_close) / d.prev_close * 100) : 0,
          change:    d.prev_close ? (d.ltp - d.prev_close) : 0,
        });
      } catch (_) {
        // Network error — silently skip, retry next interval
      }
    }

    poll(); // immediate first call
    timerRef.current = setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  // Re-run when the active symbol (symbols[0]) changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols[0]]);
}
