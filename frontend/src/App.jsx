import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSignals } from './hooks/useSignals';
import { useCandles } from './hooks/useCandles';
import { useFyersLive } from './hooks/useFyersLive';
import { useWatchlists } from './hooks/useWatchlists';
import Header from './components/Header';
import PriceChart from './components/PriceChart';
import ConvictionPanel from './components/ConvictionPanel';
import GammaTracker from './components/GammaTracker';
import DeltaGauge from './components/DeltaGauge';
import IvSkewChart from './components/IvSkewChart';
import GexChart from './components/GexChart';
import OiBuildupTable from './components/OiBuildupTable';
import UnusualActivity from './components/UnusualActivity';
import WatchlistPanel from './components/WatchlistPanel';
import HistoryPanel from './components/HistoryPanel';

const FIXED_SYMBOLS = [
  { label: 'NIFTY',      value: 'NSE:NIFTY50-INDEX' },
  { label: 'BANKNIFTY',  value: 'NSE:NIFTYBANK-INDEX' },
  { label: 'SENSEX',     value: 'BSE:SENSEX-INDEX' },
  { label: 'FINNIFTY',   value: 'NSE:FINNIFTY-INDEX' },
  { label: 'MIDCPNIFTY', value: 'NSE:MIDCPNIFTY-INDEX' },
  { label: 'BANKEX',     value: 'BSE:BANKEX-INDEX' },
];

export default function App() {
  const [symbol, setSymbol]               = useState(() => localStorage.getItem('activeSymbol') || 'NSE:NIFTY50-INDEX');
  const [timeframe, setTimeframe]         = useState(() => localStorage.getItem('activeTimeframe') || '15');
  const [mainTab, setMainTab]             = useState('overview');
  const [activeWatchlistId, setActiveWatchlistId] = useState(() => {
    const v = localStorage.getItem('activeWatchlistId');
    return v ? Number(v) : null;
  });
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  // Live ticks from FYERS WebSocket — keyed by symbol
  const [liveTicks, setLiveTicks] = useState({});

  // ── Signal data (5-min cadence, SSE-push driven) ─────────────────────────
  const {
    data,
    loading,
    error,
    lastUpdate,
    connected,
    forceRefresh,
    refreshing,
    gammaRefreshing,
    refreshGammaTracker,
  } = useSignals(symbol);

  // ── Candle data (loaded once per symbol/timeframe switch) ─────────────────
  const { candles, applyTick } = useCandles(symbol, timeframe);

  // ── Watchlist data ────────────────────────────────────────────────────────
  const {
    watchlists,
    fnoStocks,
    createWatchlist,
    deleteWatchlist,
    addSymbol,
    removeSymbol,
  } = useWatchlists();

  // All symbols to subscribe to in FYERS WebSocket
  const fyersSymbols = useMemo(() => {
    const syms = new Set([symbol]);
    watchlists.forEach(wl => wl.symbols?.forEach(s => syms.add(s)));
    return Array.from(syms).filter(Boolean);
  }, [symbol, watchlists]);

  // ── FYERS WebSocket — real-time ticks (sub-100ms) ─────────────────────────
  const onTick = useCallback((tick) => {
    setLiveTicks(prev => {
      // Skip if LTP hasn't changed (no re-render needed)
      if (prev[tick.symbol]?.ltp === tick.ltp) return prev;
      return { ...prev, [tick.symbol]: tick };
    });
    // Update the current chart candle bar in real-time
    if (tick.symbol === symbol) {
      applyTick(tick);
    }
  }, [symbol, applyTick]);

  useFyersLive(fyersSymbols, onTick);

  // ── Derived live values ───────────────────────────────────────────────────
  const signals      = data?.signals;
  const gammaTracker = data?.gammaTracker;
  const gammaStatus  = data?.gammaStatus;
  const technicals   = data?.technicals;

  const activeTick = liveTicks[symbol];

  // Latest candle close as fallback when FYERS WebSocket not yet connected
  const latestCandleClose = (() => {
    const last = candles?.[candles.length - 1];
    if (!last) return null;
    return Array.isArray(last) ? last[4] : last.close;
  })();

  // Spot priority: FYERS tick (sub-100ms) → latest candle close → snapshot spot
  const liveSpot      = activeTick?.ltp       ?? latestCandleClose ?? signals?.spot;
  const liveChange    = activeTick?.change     ?? null;
  const liveChangePct = activeTick?.changePct  ?? null;

  // ── Auto-refresh for stocks with no data yet ──────────────────────────────
  const autoRefreshDoneRef = useRef(new Set());
  const isFixedSymbol      = FIXED_SYMBOLS.some(s => s.value === symbol);
  const selectedStockMeta  = fnoStocks.find(s => s.symbol === symbol) || null;

  useEffect(() => {
    if (loading || refreshing || isFixedSymbol || signals) return;
    if (autoRefreshDoneRef.current.has(symbol)) return;
    autoRefreshDoneRef.current.add(symbol);
    forceRefresh();
  }, [symbol, loading, refreshing, isFixedSymbol, signals, forceRefresh]);

  // ── Persist UI state to localStorage ─────────────────────────────────────
  useEffect(() => { localStorage.setItem('activeSymbol', symbol || 'NSE:NIFTY50-INDEX'); }, [symbol]);
  useEffect(() => { localStorage.setItem('activeTimeframe', timeframe || 'd'); }, [timeframe]);
  useEffect(() => {
    if (activeWatchlistId == null) { localStorage.removeItem('activeWatchlistId'); return; }
    localStorage.setItem('activeWatchlistId', String(activeWatchlistId));
  }, [activeWatchlistId]);

  return (
    <div className="min-h-screen bg-bg text-slate-200 font-mono">
      <Header
        fixedSymbols={FIXED_SYMBOLS}
        symbol={symbol}
        onSymbolChange={setSymbol}
        selectedStockMeta={selectedStockMeta}
        fnoStocks={fnoStocks}
        activeWatchlistId={activeWatchlistId}
        onAddSymbolToWatchlist={addSymbol}
        spot={liveSpot}
        change={liveChange}
        changePct={liveChangePct}
        pcr={signals?.pcr}
        vix={signals?.india_vix}
        capturedAt={signals?.captured_at}
        loading={loading}
        lastUpdate={lastUpdate}
        connected={connected}
        error={error}
        onForceRefresh={forceRefresh}
        refreshing={refreshing}
        watchlistOpen={watchlistOpen}
        onToggleWatchlist={() => setWatchlistOpen(o => !o)}
        marketStatus={data?.marketStatus}
      />

      {error && (
        <div className="mx-3 mt-3 px-4 py-3 bg-red-950/40 border border-red-800/40 rounded-lg text-red-400 text-xs">
          ⚠ {error}
        </div>
      )}

      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMainTab('overview')}
            className={`px-2.5 py-1 rounded text-[11px] border ${mainTab === 'overview' ? 'bg-blue-900/50 text-blue-300 border-blue-700/50' : 'bg-slate-800/30 text-slate-400 border-slate-700/40'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setMainTab('history')}
            className={`px-2.5 py-1 rounded text-[11px] border ${mainTab === 'history' ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50' : 'bg-slate-800/30 text-slate-400 border-slate-700/40'}`}
          >
            History
          </button>
          <button
            onClick={() => setMainTab('gamma')}
            className={`px-2.5 py-1 rounded text-[11px] border ${mainTab === 'gamma' ? 'bg-fuchsia-900/50 text-fuchsia-300 border-fuchsia-700/50' : 'bg-slate-800/30 text-slate-400 border-slate-700/40'}`}
          >
            Gamma Blast
          </button>
          <button
            onClick={() => setMainTab('oi-history')}
            className={`px-2.5 py-1 rounded text-[11px] border ${mainTab === 'oi-history' ? 'bg-amber-900/50 text-amber-300 border-amber-700/50' : 'bg-slate-800/30 text-slate-400 border-slate-700/40'}`}
          >
            OI History
          </button>
          <button
            onClick={() => setMainTab('unusual-history')}
            className={`px-2.5 py-1 rounded text-[11px] border ${mainTab === 'unusual-history' ? 'bg-cyan-900/50 text-cyan-300 border-cyan-700/50' : 'bg-slate-800/30 text-slate-400 border-slate-700/40'}`}
          >
            Unusual History
          </button>
        </div>

        {mainTab === 'history' ? (
          <HistoryPanel
            symbol={symbol}
            history={data?.history}
            loading={loading}
            schedulerTelemetry={data?.schedulerTelemetry}
            title="History"
          />
        ) : mainTab === 'gamma' ? (
          <GammaTracker
            symbol={symbol}
            data={gammaTracker}
            statusData={gammaStatus}
            loading={loading}
            refreshing={gammaRefreshing}
            onRefresh={refreshGammaTracker}
            onSymbolChange={setSymbol}
          />
        ) : mainTab === 'oi-history' ? (
          <HistoryPanel
            symbol={symbol}
            history={data?.history}
            loading={loading}
            schedulerTelemetry={data?.schedulerTelemetry}
            title="OI Buildup History"
            defaultTab="oi"
            lockedTab="oi"
          />
        ) : mainTab === 'unusual-history' ? (
          <HistoryPanel
            symbol={symbol}
            history={data?.history}
            loading={loading}
            schedulerTelemetry={data?.schedulerTelemetry}
            title="Unusual Activity History"
            defaultTab="scan"
            lockedTab="scan"
          />
        ) : (
          <>
            {/* Row 1: Price chart + Conviction */}
            <div className="grid gap-3 grid-cols-1 xl:grid-cols-[1fr_300px]">
              <PriceChart
                candles={candles}
                technicals={technicals}
                gex={signals?.gex}
                spot={liveSpot}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
              />
              <ConvictionPanel conviction={signals?.conviction} />
            </div>

            {/* Row 2: Delta + IV Skew + GEX */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ minHeight: 260 }}>
              <DeltaGauge delta={signals?.net_delta} />
              <IvSkewChart skew={signals?.iv_skew} />
              <GexChart gex={signals?.gex} />
            </div>

            {/* Row 3: Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <OiBuildupTable data={signals?.oi_buildup} />
              <UnusualActivity data={signals?.unusual_activity} />
            </div>
          </>
        )}
      </div>

      {/* Watchlist slide-in panel (fixed position, outside grid) */}
      <WatchlistPanel
        open={watchlistOpen}
        onClose={() => setWatchlistOpen(false)}
        watchlists={watchlists}
        fnoStocks={fnoStocks}
        activeSymbol={symbol}
        activeLiveSpot={liveSpot}
        activeConvictionDirection={signals?.conviction?.direction}
        activeConvictionConfidence={signals?.conviction?.confidence}
        activeWatchlistId={activeWatchlistId}
        onSelectWatchlist={setActiveWatchlistId}
        onCreateWatchlist={createWatchlist}
        onDeleteWatchlist={deleteWatchlist}
        onAddSymbol={addSymbol}
        onRemoveSymbol={removeSymbol}
        onSelectSymbol={(sym) => { setSymbol(sym); setWatchlistOpen(false); }}
        liveTicks={liveTicks}
      />
    </div>
  );
}
