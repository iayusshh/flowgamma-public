import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/$/, '');

async function apiFetch(url, options) {
  const r = await fetch(url, options);
  if (r.ok) return r.json();
  const err = await r.json().catch(() => ({ detail: r.statusText }));
  throw new Error(err.detail || r.statusText);
}

const DIRECTION_CONFIG = {
  BULLISH: { icon: '↑', color: 'text-green-400',  label: 'BULL' },
  BEARISH: { icon: '↓', color: 'text-red-400',    label: 'BEAR' },
  NEUTRAL: { icon: '→', color: 'text-slate-400',  label: 'NEUT' },
};

function fmtINR(v) {
  if (v == null) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortLabel(sym) {
  return sym.replace('NSE:', '').replace('BSE:', '').replace('-EQ', '').replace('-INDEX', '');
}

function ageLabel(ts, nowMs) {
  if (!ts) return '--';
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return '--';
  const secs = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

export default function WatchlistPanel({
  open, onClose,
  watchlists, fnoStocks,
  activeSymbol,
  activeLiveSpot,
  activeConvictionDirection,
  activeConvictionConfidence,
  activeWatchlistId, onSelectWatchlist,
  onCreateWatchlist, onDeleteWatchlist,
  onAddSymbol, onRemoveSymbol,
  onSelectSymbol,
}) {
  const [nowMs, setNowMs]           = useState(Date.now());
  const [query, setQuery]           = useState('');
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState('');
  const [addingSymbol, setAddingSymbol] = useState(null);
  const [addError, setAddError]     = useState(null);
  const [summary, setSummary]       = useState({});
  const summaryTimerRef             = useRef(null);
  const refreshTimerRef             = useRef(null);
  const searchInputRef              = useRef(null);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await apiFetch(`${API_BASE}/watchlists/summary`);
      setSummary(data.summary || {});
    } catch {}
  }, []);

  // Poll summary while panel is open
  useEffect(() => {
    if (!open) {
      clearInterval(summaryTimerRef.current);
      clearInterval(refreshTimerRef.current);
      return;
    }
    fetchSummary();
    summaryTimerRef.current = setInterval(fetchSummary, 5 * 1000);

    // Keep watchlist conviction/LTP moving even if scheduler isn't manually started.
    const triggerTrackedRefresh = () => {
      fetch(`${API_BASE}/refresh-all-tracked`, { method: 'POST' }).catch(() => {});
    };
    refreshTimerRef.current = setInterval(triggerTrackedRefresh, 5 * 60 * 1000);

    return () => {
      clearInterval(summaryTimerRef.current);
      clearInterval(refreshTimerRef.current);
    };
  }, [open, fetchSummary]);

  useEffect(() => {
    if (!open) return;
    fetchSummary();
  }, [open, activeWatchlistId, fetchSummary]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Auto-select first watchlist when none selected
  useEffect(() => {
    if (open && !activeWatchlistId && watchlists?.length) {
      onSelectWatchlist(watchlists[0].id);
    }
  }, [open, watchlists, activeWatchlistId, onSelectWatchlist]);

  // Focus search when panel opens
  useEffect(() => {
    if (open) setTimeout(() => searchInputRef.current?.focus(), 150);
  }, [open]);

  const activeWatchlist = watchlists?.find(w => w.id === activeWatchlistId);
  const activeSymbols   = activeWatchlist?.symbols || [];

  // Filter fnoStocks by query, excluding already-added ones
  const addedSet = new Set(activeSymbols);
  const searchResults = query.length >= 1
    ? (fnoStocks || [])
        .filter(s => {
          const q = query.toLowerCase();
          return s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
        })
        .filter(s => !addedSet.has(s.symbol))
        .slice(0, 8)
    : [];

  const handleAdd = async (sym) => {
    if (!activeWatchlistId || addingSymbol) return;
    setAddError(null);
    setAddingSymbol(sym);
    setQuery('');
    try {
      await onAddSymbol(activeWatchlistId, sym);
      setTimeout(fetchSummary, 5000); // Refresh after backend collects data
    } catch (e) {
      setAddError(e.message || 'Failed to add symbol');
    } finally {
      setAddingSymbol(null);
    }
  };

  const handleRemove = async (sym) => {
    if (!activeWatchlistId) return;
    setAddError(null);
    try {
      await onRemoveSymbol(activeWatchlistId, sym);
      setSummary(prev => { const n = { ...prev }; delete n[sym]; return n; });
    } catch (e) {
      setAddError(e.message);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setAddError(null);
    try {
      const wl = await onCreateWatchlist(newName.trim());
      setNewName('');
      setCreating(false);
      if (wl?.id) onSelectWatchlist(wl.id);
    } catch (e) {
      setAddError(e.message);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this watchlist and all its stocks?')) return;
    setAddError(null);
    try {
      await onDeleteWatchlist(id);
      if (activeWatchlistId === id) onSelectWatchlist(watchlists?.find(w => w.id !== id)?.id ?? null);
    } catch (e) {
      setAddError(e.message);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full z-40 flex flex-col bg-[#0d1117] border-l border-[#1e2d3d] shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 340 }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d3d] shrink-0">
          <span className="text-[11px] font-semibold text-slate-300 tracking-widest">WATCHLIST</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xs p-1 leading-none">✕</button>
        </div>

        {/* Watchlist tabs */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1e2d3d] shrink-0 flex-wrap">
          {(watchlists || []).map(wl => (
            <div key={wl.id} className="flex items-center gap-0.5 group">
              <button
                onClick={() => onSelectWatchlist(wl.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  activeWatchlistId === wl.id
                    ? 'bg-blue-900/60 text-blue-300'
                    : 'text-slate-500 hover:text-slate-300 bg-slate-800/40'
                }`}
              >
                {wl.name}
              </button>
              <button
                onClick={(e) => handleDelete(wl.id, e)}
                className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 text-[9px] transition-opacity ml-0.5"
                title="Delete watchlist"
              >×</button>
            </div>
          ))}

          {(!watchlists || watchlists.filter(w => !w.is_default).length < 5) && (
            creating ? (
              <div className="flex items-center gap-1">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  placeholder="Name…"
                  autoFocus
                  maxLength={40}
                  className="w-20 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-slate-200 outline-none focus:border-blue-500"
                />
                <button onClick={handleCreate} className="text-green-400 text-[10px] px-1 hover:text-green-300">✓</button>
                <button onClick={() => { setCreating(false); setNewName(''); }} className="text-slate-500 text-[10px] hover:text-slate-300">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-200 bg-slate-800/40 border border-slate-700/40 transition-colors"
                title="New watchlist"
              >+ New</button>
            )
          )}
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-[#1e2d3d] shrink-0 relative">
          <div className={`flex items-center gap-2 bg-slate-800/60 border rounded-md px-2.5 py-1.5 transition-colors ${
            activeWatchlistId ? 'border-slate-700/40' : 'border-slate-800/40 opacity-50'
          }`}>
            <span className="text-slate-500 text-[11px]">🔍</span>
            <input
              ref={searchInputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setAddError(null); }}
              onKeyDown={e => {
                if (e.key === 'Escape') setQuery('');
                if (e.key === 'Enter' && searchResults.length === 1) handleAdd(searchResults[0].symbol);
              }}
              placeholder={activeWatchlistId ? 'Search F&O stocks to add…' : 'Select a watchlist first'}
              disabled={!activeWatchlistId}
              className="flex-1 bg-transparent text-[11px] text-slate-200 placeholder-slate-600 outline-none disabled:cursor-not-allowed"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-600 hover:text-slate-400 text-[10px] leading-none">✕</button>
            )}
          </div>

          {/* Search dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-3 right-3 mt-1 bg-[#1a2332] border border-[#1e2d3d] rounded-md shadow-2xl z-10 overflow-hidden">
              {searchResults.map(s => (
                <button
                  key={s.symbol}
                  onClick={() => handleAdd(s.symbol)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-slate-700/40 transition-colors text-left"
                >
                  <span className="text-slate-200 font-semibold shrink-0">{shortLabel(s.symbol)}</span>
                  <span className="text-slate-500 truncate">{s.name}</span>
                  <span className="ml-auto text-slate-600 text-[9px] shrink-0">+ add</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error banner */}
        {addError && (
          <div className="px-3 py-1.5 text-[10px] text-red-400 bg-red-950/20 border-b border-red-900/30 shrink-0">
            ⚠ {addError}
            <button onClick={() => setAddError(null)} className="ml-2 text-red-600 hover:text-red-400">✕</button>
          </div>
        )}

        {/* Stock list */}
        <div className="flex-1 overflow-y-auto">
          {!activeWatchlistId ? (
            <div className="px-4 py-8 text-[11px] text-slate-600 text-center">
              Select or create a watchlist above
            </div>
          ) : activeSymbols.length === 0 ? (
            <div className="px-4 py-8 text-[11px] text-slate-600 text-center">
              No stocks yet — search above to add
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="flex items-center px-3 py-1.5 border-b border-[#1e2d3d] text-[9px] text-slate-600 uppercase tracking-wider">
                <span className="flex-1">Symbol</span>
                <span className="w-24 text-right">LTP</span>
                <span className="w-14 text-right">Signal</span>
                <span className="w-10 text-right">Age</span>
                <span className="w-5" />
              </div>

              {activeSymbols.map(sym => {
                const info = summary[sym] || {};
                const isActive  = sym === activeSymbol;
                const effectiveInfo = (isActive && activeLiveSpot != null)
                  ? {
                      ...info,
                      ltp: activeLiveSpot,
                      ltp_source: 'live_app',
                      direction: activeConvictionDirection || info.direction || 'NEUTRAL',
                      confidence: activeConvictionConfidence ?? info.confidence,
                      fetched_at: new Date().toISOString(),
                    }
                  : info;

                const dir     = effectiveInfo?.direction || 'NEUTRAL';
                const cfg     = DIRECTION_CONFIG[dir] || DIRECTION_CONFIG.NEUTRAL;
                const isAdding  = addingSymbol === sym;
                const fetchedAge = ageLabel(effectiveInfo?.fetched_at, nowMs);
                const src = (effectiveInfo?.ltp_source || '').toUpperCase();
                const isLive = src.startsWith('LIVE');

                return (
                  <div
                    key={sym}
                    className={`flex items-center px-3 py-2.5 border-b border-[#1e2d3d]/50 transition-colors ${
                      isActive ? 'bg-blue-950/30' : 'hover:bg-slate-800/20'
                    }`}
                  >
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => onSelectSymbol(sym)}
                      title={sym}
                    >
                      <span className={`text-[11px] font-semibold ${isActive ? 'text-blue-300' : 'text-slate-200'}`}>
                        {shortLabel(sym)}
                      </span>
                      <span className={`ml-2 text-[8px] px-1 py-0.5 rounded border ${isLive ? 'text-emerald-300 border-emerald-700/40 bg-emerald-900/20' : 'text-slate-500 border-slate-700/50 bg-slate-800/40'}`}>
                        {isLive ? 'LIVE' : 'DB'}
                      </span>
                    </button>

                    <span className="w-24 text-right text-[10px] font-mono shrink-0">
                      {isAdding ? (
                        <span className="text-slate-600 animate-pulse">collecting…</span>
                      ) : effectiveInfo?.ltp != null ? (
                        <span className="text-slate-300">{fmtINR(effectiveInfo.ltp)}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </span>

                    <span className={`w-14 text-right text-[10px] font-semibold shrink-0 ${cfg.color}`}>
                      {!isAdding && `${cfg.icon} ${cfg.label}`}
                    </span>

                    <span className="w-10 text-right text-[9px] text-slate-500 shrink-0">
                      {!isAdding ? fetchedAge : '--'}
                    </span>

                    <button
                      onClick={() => handleRemove(sym)}
                      className="w-5 text-center text-slate-700 hover:text-red-400 text-[11px] transition-colors shrink-0"
                      title="Remove from watchlist"
                    >✕</button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}
