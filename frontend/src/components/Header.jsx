import { useMemo, useState } from 'react';

export default function Header({
  // Fixed symbol tabs
  fixedSymbols, symbol, onSymbolChange,
  selectedStockMeta,
  fnoStocks = [],
  activeWatchlistId,
  onAddSymbolToWatchlist,
  // Market data chips
  spot, change, changePct, pcr, vix, capturedAt,
  // Connection status
  loading, lastUpdate, connected, error,
  onForceRefresh, refreshing,
  // Watchlist panel toggle
  watchlistOpen, onToggleWatchlist,
  marketStatus,
}) {
  const [stockOpen, setStockOpen] = useState(false);
  const [stockQuery, setStockQuery] = useState('');
  const [addingStock, setAddingStock] = useState(null);

  const fmtINR = v => v != null
    ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

  const shortSymbol = (sym) => (sym || '').replace('NSE:', '').replace('BSE:', '').replace('-EQ', '').replace('-INDEX', '');

  const pcrColor = pcr == null ? 'gray' : pcr > 1.2 ? 'green' : pcr < 0.8 ? 'red' : 'gray';
  const vixColor = vix == null ? 'gray' : vix > 20 ? 'red' : vix < 12 ? 'green' : 'gray';

  const chipClasses = {
    green: 'bg-green-950/50 text-green-400 border-green-800/40',
    red:   'bg-red-950/50 text-red-400 border-red-800/40',
    gray:  'bg-slate-800/40 text-slate-400 border-slate-700/40',
  };

  const updateTime = lastUpdate
    ? lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const marketOpen = marketStatus?.is_open;
  const marketReason = marketStatus?.reason || 'unknown';

  const isFixedSymbol = (fixedSymbols || []).some(s => s.value === symbol);
  const stockList = useMemo(() => {
    const q = stockQuery.trim().toLowerCase();
    const src = fnoStocks || [];
    if (!q) return src.slice(0, 120);
    return src
      .filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 120);
  }, [fnoStocks, stockQuery]);

  const handleAddStock = async (stockSymbol) => {
    if (!activeWatchlistId || !onAddSymbolToWatchlist) return;
    setAddingStock(stockSymbol);
    try {
      await onAddSymbolToWatchlist(activeWatchlistId, stockSymbol);
    } finally {
      setAddingStock(null);
    }
  };

  return (
    <>
    <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-[#1e2d3d]">

      {/* ── Row 1: Title · Index tabs · Market data · Watchlist · Refresh · Status ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">

        {/* Title */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs font-semibold tracking-wider">FLOW</span>
          <span className="text-blue-400 text-xs font-semibold tracking-wider">GAMMA</span>
        </div>

        <div className="w-px h-4 bg-[#1e2d3d]" />

        {/* Fixed index symbol tabs */}
        <div className="flex gap-0.5 bg-[#0d1117] rounded-lg p-0.5 border border-[#1e2d3d]">
          {(fixedSymbols || []).map(s => (
            <button
              key={s.value}
              onClick={() => onSymbolChange(s.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                symbol === s.value
                  ? 'bg-blue-900/60 text-blue-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => setStockOpen(true)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              !isFixedSymbol
                ? 'bg-emerald-900/60 text-emerald-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            STOCK
          </button>
        </div>

        {!isFixedSymbol && selectedStockMeta && (
          <span className="text-[11px] text-emerald-300 border border-emerald-800/40 bg-emerald-950/30 rounded px-2 py-0.5">
            {selectedStockMeta.name} ({shortSymbol(selectedStockMeta.symbol)})
          </span>
        )}

        {/* Spot price + live change */}
        {spot != null && (
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono font-bold text-slate-100 text-base tracking-tight">
              ₹{fmtINR(spot)}
            </span>
            {changePct != null && (
              <span className={`text-[11px] font-semibold font-mono ${changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            )}
          </span>
        )}

        {/* PCR chip */}
        {pcr != null && (
          <span className={`chip border ${chipClasses[pcrColor]}`}>
            PCR <span className="font-bold">{pcr.toFixed(2)}</span>
          </span>
        )}

        {/* VIX chip */}
        {vix != null && (
          <span className={`chip border ${chipClasses[vixColor]}`}>
            VIX <span className="font-bold">{vix.toFixed(1)}</span>
          </span>
        )}

        <div className="flex-1" />

        <a
          href="/admin"
          className="px-2.5 py-1 text-[10px] rounded-md border font-semibold transition-all bg-fuchsia-900/40 border-fuchsia-700/40 text-fuchsia-200 hover:bg-fuchsia-800/50"
          title="Open admin control panel"
        >
          ADMIN
        </a>

        {/* Watchlist toggle */}
        <button
          onClick={onToggleWatchlist}
          className={`px-2.5 py-1 text-[10px] rounded-md border font-semibold transition-all ${
            watchlistOpen
              ? 'bg-blue-900/50 border-blue-700/40 text-blue-300'
              : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
          }`}
        >
          WATCHLIST
        </button>

        {/* Force refresh */}
        <button
          onClick={onForceRefresh}
          disabled={refreshing || loading}
          title="Force fetch fresh data from FYERS"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all ${
            refreshing
              ? 'bg-blue-900/40 border-blue-700/40 text-blue-400 cursor-not-allowed'
              : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
          }`}
        >
          <svg
            className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {refreshing ? 'Fetching…' : 'Refresh'}
        </button>

        {/* Status */}
        <div className="flex items-center gap-2 text-[10px] text-slate-600">
          <div
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
              marketOpen
                ? 'border-emerald-700/40 bg-emerald-950/30 text-emerald-300'
                : 'border-amber-700/40 bg-amber-950/30 text-amber-300'
            }`}
            title={`Market status: ${marketReason}`}
          >
            <span className="text-[9px] font-semibold tracking-wide">
              {marketOpen ? 'OPEN' : 'CLOSED'}
            </span>
            <span className="relative inline-flex h-3.5 w-6 items-center rounded-full bg-slate-800/70">
              <span
                className={`inline-block h-2.5 w-2.5 transform rounded-full transition ${
                  marketOpen ? 'translate-x-3 bg-emerald-400' : 'translate-x-0.5 bg-amber-400'
                }`}
              />
            </span>
          </div>
          <span>updated {updateTime}</span>
          {loading && <span className="text-blue-600 animate-pulse">syncing…</span>}
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-600'
            }`}
            title={connected ? 'Connected' : 'Disconnected'}
          />
        </div>
      </div>

    </header>
    {stockOpen && (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20" onClick={() => setStockOpen(false)}>
        <div
          className="w-[760px] max-w-[96vw] max-h-[80vh] overflow-hidden rounded-xl border border-[#1e2d3d] bg-[#0d1117] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d3d]">
            <div>
              <div className="text-xs font-semibold text-slate-200 tracking-wide">STOCK PICKER</div>
              <div className="text-[10px] text-slate-500">Search all F&O eligible stocks, view on dashboard, or add to active watchlist.</div>
            </div>
            <button onClick={() => setStockOpen(false)} className="text-slate-500 hover:text-slate-200 text-xs">X</button>
          </div>

          <div className="px-4 py-3 border-b border-[#1e2d3d]">
            <input
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
              placeholder="Search by stock name or symbol..."
              className="w-full rounded-md border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-600/70"
            />
            <div className="mt-2 text-[10px] text-slate-500">
              Active watchlist: {activeWatchlistId ? `#${activeWatchlistId}` : 'None selected'}
            </div>
          </div>

          <div className="max-h-[56vh] overflow-y-auto">
            <div className="grid grid-cols-[1.2fr_1fr_auto_auto] gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-slate-600 border-b border-[#1e2d3d]">
              <span>Name</span>
              <span>Symbol</span>
              <span className="text-right">View</span>
              <span className="text-right">Add</span>
            </div>

            {stockList.map((s) => (
              <div key={s.symbol} className="grid grid-cols-[1.2fr_1fr_auto_auto] gap-2 items-center px-4 py-2 border-b border-[#1e2d3d]/50">
                <span className="text-[11px] text-slate-200 truncate">{s.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">{shortSymbol(s.symbol)}</span>
                <button
                  onClick={() => { onSymbolChange(s.symbol); setStockOpen(false); }}
                  className="text-[10px] px-2 py-1 rounded border border-blue-700/40 text-blue-300 hover:bg-blue-900/30"
                >
                  Open
                </button>
                <button
                  onClick={() => handleAddStock(s.symbol)}
                  disabled={!activeWatchlistId || addingStock === s.symbol}
                  className={`text-[10px] px-2 py-1 rounded border ${
                    !activeWatchlistId
                      ? 'border-slate-700/40 text-slate-600 cursor-not-allowed'
                      : 'border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/30'
                  }`}
                >
                  {addingStock === s.symbol ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
