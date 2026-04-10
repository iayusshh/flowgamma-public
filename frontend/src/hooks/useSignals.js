/**
 * useSignals — signals, technicals, gamma tracker, and history.
 *
 * Candles and live quotes are now handled by useCandles + useFyersLive.
 * This hook is responsible only for computed signal data.
 *
 * Data refresh strategy:
 *   - Initial load: fetch all signal endpoints in parallel immediately
 *   - Live updates: SSE stream from /stream/{symbol} — backend pushes when
 *     a new snapshot is ready (< 2s after collection, not 0-5 min polling luck)
 *   - Fallback: 5-minute interval poll in case SSE connection drops
 *   - forceRefresh: fire-and-forget backend refresh, then immediate fetch from cache
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/$/, '');

const FIXED_SYMBOLS = new Set([
  'NSE:NIFTY50-INDEX',
  'NSE:NIFTYBANK-INDEX',
  'BSE:SENSEX-INDEX',
  'NSE:FINNIFTY-INDEX',
  'NSE:MIDCPNIFTY-INDEX',
  'BSE:BANKEX-INDEX',
]);

// Fallback poll interval (SSE is primary; this catches dropped SSE connections)
const SIGNAL_FALLBACK_POLL_MS = 5 * 60 * 1000;
const TELEMETRY_POLL_MS = 10_000;

async function safeFetch(url) {
  try {
    const r = await fetch(url);
    if (r.ok) {
      return { ok: true, status: r.status, data: await r.json(), networkError: false };
    }
    const err = await r.json().catch(() => ({}));
    return {
      ok: false,
      status: r.status,
      data: null,
      detail: err.detail || r.statusText || 'Request failed',
      networkError: false,
    };
  } catch {
    return { ok: false, status: 0, data: null, detail: 'Network error', networkError: true };
  }
}

export function useSignals(symbol) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    lastUpdate: null,
    connected: false,
    refreshing: false,
    gammaRefreshing: false,
  });

  // Keep previous data so we never blank the UI on symbol switch
  const prevDataRef       = useRef(null);
  const signalTimerRef    = useRef(null);
  const telemetryTimerRef = useRef(null);
  const sseRef            = useRef(null);

  const fetchSignals = useCallback(async () => {
    const enc = encodeURIComponent(symbol);
    const [
      signalsRes, technicalsRes, gammaRes, gammaStatusRes,
      convictionHistRes, oiHistRes, scanHistRes, ivSkewHistRes, gexHistRes, marketStatusRes,
    ] = await Promise.all([
      safeFetch(`${API_BASE}/signals/${enc}`),
      safeFetch(`${API_BASE}/technicals/${enc}`),
      safeFetch(`${API_BASE}/signals/${enc}/gamma-tracker`),
      safeFetch(`${API_BASE}/gamma-tracker/status`),
      safeFetch(`${API_BASE}/history/${enc}/conviction?days=3&bucket=5m`),
      safeFetch(`${API_BASE}/history/${enc}/oi-buildup?days=3&bucket=5m`),
      safeFetch(`${API_BASE}/history/${enc}/scan?days=3&bucket=5m`),
      safeFetch(`${API_BASE}/history/${enc}/iv-skew?days=3&bucket=5m`),
      safeFetch(`${API_BASE}/history/${enc}/gex?days=3&bucket=5m`),
      safeFetch(`${API_BASE}/market-status`),
    ]);

    const signals      = signalsRes.ok      ? signalsRes.data      : null;
    const technicals   = technicalsRes.ok   ? technicalsRes.data   : null;
    const gammaTracker = gammaRes.ok        ? gammaRes.data        : null;
    const gammaStatus  = gammaStatusRes.ok  ? gammaStatusRes.data  : null;
    const marketStatus = marketStatusRes.ok ? marketStatusRes.data : null;
    const history = {
      conviction: convictionHistRes.ok ? convictionHistRes.data : null,
      oiBuildup:  oiHistRes.ok         ? oiHistRes.data         : null,
      scan:       scanHistRes.ok       ? scanHistRes.data       : null,
      ivSkew:     ivSkewHistRes.ok     ? ivSkewHistRes.data     : null,
      gex:        gexHistRes.ok        ? gexHistRes.data        : null,
    };

    const networkDown     = signalsRes.networkError && technicalsRes.networkError;
    const signalsPending  = !!(signals && signals.status === 'data_pending');
    const technicalsPending = !!(technicals && technicals.status === 'data_pending');
    const dataPending     = signalsPending || technicalsPending || (!signals && (signalsRes.status === 404 || technicalsRes.status === 404));
    const connected       = !networkDown;

    let nextError = null;
    if (networkDown) {
      nextError = 'Cannot reach API — is the backend running?';
    } else if (dataPending) {
      nextError = `No data yet for ${symbol}. Fetch in progress, please wait 30-90s.`;
    }

    const freshData = {
      ...(prevDataRef.current || {}),
      signals,
      technicals,
      gammaTracker,
      gammaStatus,
      marketStatus,
      history,
    };
    prevDataRef.current = freshData;

    setState(prev => ({
      ...prev,
      data: freshData,
      error: nextError,
      lastUpdate: new Date(),
      connected,
      loading: false,
    }));
  }, [symbol]);

  const fetchSchedulerTelemetry = useCallback(async () => {
    const res = await safeFetch(`${API_BASE}/health/scheduler`);
    if (!res.ok) return;
    setState(prev => ({
      ...prev,
      data: { ...(prev.data || {}), schedulerTelemetry: res.data },
    }));
  }, []);

  // forceRefresh: fire-and-forget backend collection, immediately fetch from cache
  // No more 20-second wait — backend in-memory cache serves the response in < 5ms
  const forceRefresh = useCallback(async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    try {
      // Tell backend to start collecting — don't wait for it
      fetch(`${API_BASE}/refresh-all-tracked`, { method: 'POST' }).catch(() => {});
      // Immediately fetch whatever is cached (responds in < 5ms from signal cache)
      await fetchSignals();
    } finally {
      setState(prev => ({ ...prev, refreshing: false }));
    }
  }, [fetchSignals]);

  // Panel-scoped Gamma Tracker refresh
  const refreshGammaTracker = useCallback(async () => {
    setState(prev => ({ ...prev, gammaRefreshing: true }));
    try {
      fetch(`${API_BASE}/gamma-tracker/refresh`, { method: 'POST' }).catch(() => {});
      // Brief wait then refetch (gamma tracker needs time to process)
      await new Promise(r => setTimeout(r, 3000));
      await fetchSignals();
    } finally {
      setState(prev => ({ ...prev, gammaRefreshing: false }));
    }
  }, [fetchSignals]);

  // SSE subscription + fallback polling
  useEffect(() => {
    // Show stale data from previous symbol while new data loads (never blank)
    setState(prev => ({
      ...prev,
      loading: !prevDataRef.current,
      data: prevDataRef.current,   // keep showing previous data
      connected: false,
    }));

    // Initial fetch
    fetchSignals();
    fetchSchedulerTelemetry();

    // Fallback poll — catches cases where SSE drops silently
    signalTimerRef.current    = setInterval(fetchSignals, SIGNAL_FALLBACK_POLL_MS);
    telemetryTimerRef.current = setInterval(fetchSchedulerTelemetry, TELEMETRY_POLL_MS);

    // SSE subscription — primary update path (replaces 5-min polling)
    const enc = encodeURIComponent(symbol);
    const es  = new EventSource(`${API_BASE}/stream/${enc}`);
    es.onmessage = (e) => {
      if (e.data && e.data !== 'ping') {
        // Backend says new snapshot is ready — fetch fresh signals immediately
        fetchSignals();
      }
    };
    es.onerror = () => {
      // Browser auto-reconnects SSE; no action needed here
    };
    sseRef.current = es;

    return () => {
      clearInterval(signalTimerRef.current);
      clearInterval(telemetryTimerRef.current);
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [symbol, fetchSignals, fetchSchedulerTelemetry]);

  // Notify backend of active symbol (for scheduler prioritization)
  useEffect(() => {
    fetch(`${API_BASE}/active-symbol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: symbol || 'NSE:NIFTY50-INDEX' }),
    }).catch(() => {});
  }, [symbol]);

  return { ...state, forceRefresh, refreshGammaTracker };
}
