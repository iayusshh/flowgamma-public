import { useMemo } from 'react';

const TRACKED_SYMBOLS = [
  'NSE:NIFTY50-INDEX',
  'NSE:NIFTYBANK-INDEX',
  'BSE:SENSEX-INDEX',
];

function stanceTheme(stance = '') {
  const s = String(stance).toUpperCase();
  if (s.includes('SHORT') || s.includes('BEAR')) {
    return {
      row: 'bg-red-950/25 border border-red-800/35',
      text: 'text-red-400',
    };
  }
  if (s.includes('LONG') || s.includes('BULL')) {
    return {
      row: 'bg-green-950/25 border border-green-800/35',
      text: 'text-green-400',
    };
  }
  return {
    row: 'bg-slate-900/50 border border-slate-700/35',
    text: 'text-slate-300',
  };
}

function scoreClass(score) {
  if (score > 0.08) return 'text-green-400';
  if (score < -0.08) return 'text-red-400';
  return 'text-slate-400';
}

function scoreDesc(label, score) {
  const abs = Math.abs(score || 0);
  const dir = score > 0.08 ? 'bullish' : score < -0.08 ? 'bearish' : 'mixed';
  if (label === 'OI Momentum') {
    if (dir === 'bullish') return abs > 0.5 ? 'Call buying / put writing' : 'Flow tilting bullish';
    if (dir === 'bearish') return abs > 0.5 ? 'Put buying / call writing' : 'Flow tilting bearish';
    return 'OI flow not aligned yet';
  }
  if (label === 'Gamma Structure') {
    if (dir === 'bullish') return abs > 0.5 ? 'Structure supports upside' : 'Structure mildly bullish';
    if (dir === 'bearish') return abs > 0.5 ? 'Structure favors downside' : 'Structure mildly bearish';
    return 'Walls/gravity are balanced';
  }
  if (dir === 'bullish') return abs > 0.5 ? 'Breakout momentum active' : 'Price confirmation building';
  if (dir === 'bearish') return abs > 0.5 ? 'Breakdown momentum active' : 'Price weakness emerging';
  return 'Price confirmation is flat';
}

function fmtSigned(n, digits = 2) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '--';
  return `${num >= 0 ? '+' : ''}${num.toFixed(digits)}`;
}

function fmtNum(n, digits = 0) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '--';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtTs(ts) {
  if (!ts) return '--:--';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function shortSym(sym) {
  return String(sym || '').replace('NSE:', '').replace('BSE:', '').replace('-INDEX', '');
}

export default function GammaTracker({
  symbol,
  data,
  statusData,
  loading,
  refreshing,
  onRefresh,
  onSymbolChange,
}) {
  const isInsufficient = data?.status === 'insufficient_data';
  const scores = data?.scores || {};
  const levels = data?.key_levels || {};
  const history = Array.isArray(data?.history) ? data.history.slice(-6) : [];

  const theme = stanceTheme(data?.stance);

  const quickCards = useMemo(() => {
    return TRACKED_SYMBOLS.map((sym) => {
      const row = statusData?.[sym] || {};
      const statusLabel = row?.status === 'insufficient_data' ? 'NOT READY' : row?.status;
      return {
        symbol: sym,
        stance: row?.stance || statusLabel || 'NOT READY',
        score: row?.signed_score,
      };
    });
  }, [statusData]);

  return (
    <div className="panel p-4">
      <div className="panel-header -mx-4 -mt-4 mb-3">
        <span className="panel-label">Gamma Blast Tracker</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-300">{symbol}</span>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
              refreshing
                ? 'bg-blue-900/40 border-blue-700/40 text-blue-300 cursor-not-allowed'
                : 'bg-slate-800/40 border-slate-700/40 text-blue-300 hover:bg-slate-700/40'
            }`}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-12 rounded bg-[#1e2d3d]" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-14 rounded bg-[#1e2d3d]" />
            <div className="h-14 rounded bg-[#1e2d3d]" />
            <div className="h-14 rounded bg-[#1e2d3d]" />
          </div>
          <div className="h-24 rounded bg-[#1e2d3d]" />
        </div>
      ) : isInsufficient ? (
        <div className="space-y-3">
          <div className="rounded-md border border-slate-700/40 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-400">
            Gamma Tracker needs at least 2 snapshots for this symbol.
          </div>

          <div className="text-[10px] text-slate-500 uppercase tracking-widest">Quick View</div>
          <div className="grid grid-cols-3 gap-2">
            {quickCards.map((card) => {
              const cardTheme = stanceTheme(card.stance);
              return (
                <button
                  key={card.symbol}
                  onClick={() => onSymbolChange?.(card.symbol)}
                  className={`rounded-md px-2 py-2 text-center border transition-colors ${cardTheme.row} hover:border-blue-700/40`}
                >
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{shortSym(card.symbol)}</div>
                  <div className={`text-[11px] font-semibold ${cardTheme.text}`}>{card.stance}</div>
                  <div className="text-[10px] text-slate-400">{fmtSigned(card.score, 2)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`rounded-md px-3 py-2 flex items-center gap-3 ${theme.row}`}>
            <span className={`text-[15px] font-semibold ${theme.text}`}>{data?.stance || 'STANCE NOT CLEAR'}</span>
            <span className="text-[12px] text-slate-300">{fmtSigned(data?.signed_score, 3)}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className={`text-[10px] px-2 py-0.5 rounded ${data?.confirmation === 'CONFIRMED' ? 'bg-green-950/60 text-green-400' : 'bg-amber-950/50 text-amber-400'}`}>
                {data?.confirmation || '-'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/50 text-blue-300">
                {data?.trend || 'HOLDING'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {fmtNum(data?.tte_minutes, 0)} min
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ['OI Momentum', scores.oi_momentum],
              ['Gamma Structure', scores.gamma_structure],
              ['Price Action', scores.price_action],
            ].map(([label, val]) => (
              <div key={label} className="rounded-md bg-[#0f1722] border border-[#1e2d3d] px-2.5 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
                <div className={`text-[14px] font-semibold ${scoreClass(Number(val || 0))}`}>{fmtSigned(val, 3)}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{scoreDesc(label, Number(val || 0))}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Gamma flip</span>
              <span className="text-slate-200 font-semibold">
                {fmtNum(levels.gamma_flip)}
                <span className={`ml-1 text-[10px] ${levels.spot_above_flip ? 'text-blue-300' : 'text-red-400'}`}>
                  {levels.spot_above_flip ? 'DAMPENING' : 'AMPLIFYING'}
                </span>
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Gravity center</span>
              <span className="text-slate-200 font-semibold">
                {fmtNum(levels.gravity_center)}
                <span className="ml-1 text-[10px] text-slate-500">({fmtSigned(levels.gravity_drift, 1)})</span>
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Call wall</span>
              <span className="text-slate-200 font-semibold">
                {fmtNum(levels.nearest_call_wall?.strike)}
                <span className="ml-1 text-[10px] text-slate-500">({fmtNum(levels.nearest_call_wall?.strength, 2)})</span>
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Put wall</span>
              <span className="text-slate-200 font-semibold">
                {fmtNum(levels.nearest_put_wall?.strike)}
                <span className="ml-1 text-[10px] text-slate-500">({fmtNum(levels.nearest_put_wall?.strength, 2)})</span>
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Pin zone</span>
              <span className="text-slate-200 font-semibold">
                {Array.isArray(levels.pin_zone)
                  ? `${fmtNum(levels.pin_zone[0])} - ${fmtNum(levels.pin_zone[1])}`
                  : '--'}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">ATM straddle</span>
              <span className="text-slate-200 font-semibold">{fmtNum(levels.atm_straddle, 2)}</span>
            </div>
          </div>

          <div className="rounded-md border-l-2 border-green-500 bg-[#0f1722] px-2.5 py-2 text-[11px] text-slate-300">
            {data?.upgrade_condition || 'Need stronger aligned conditions for upgrade.'}
          </div>
          <div className="rounded-md border-l-2 border-red-500 bg-[#0f1722] px-2.5 py-2 text-[11px] text-slate-300">
            {data?.downgrade_condition || 'Any reversal in flow or price confirmation can downgrade stance.'}
          </div>

          <div className="border-t border-[#1e2d3d] pt-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Signal history (last snapshots)</div>
            <div className="space-y-1">
              {history.length === 0 && (
                <div className="text-[10px] text-slate-500">No history yet. It will build as snapshots arrive.</div>
              )}
              {history.map((h) => {
                const abs = Math.min(Math.abs(Number(h.signed_score || 0)), 1);
                const width = Math.max(4, Math.round(abs * 64));
                const cls = Number(h.signed_score || 0) > 0.08
                  ? 'bg-green-500'
                  : Number(h.signed_score || 0) < -0.08
                    ? 'bg-red-500'
                    : 'bg-slate-600';
                return (
                  <div key={`${h.timestamp}-${h.signed_score}`} className="flex items-center gap-2 text-[10px]">
                    <span className="w-10 text-slate-500">{fmtTs(h.timestamp)}</span>
                    <div className={`h-1 rounded ${cls}`} style={{ width }} />
                    <span className="text-slate-400 w-36 truncate">{h.stance || 'STANCE NOT CLEAR'}</span>
                    <span className={scoreClass(Number(h.signed_score || 0))}>{fmtSigned(h.signed_score, 2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#1e2d3d] pt-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Quick view</div>
            <div className="grid grid-cols-3 gap-2">
              {quickCards.map((card) => {
                const cardTheme = stanceTheme(card.stance);
                return (
                  <button
                    key={card.symbol}
                    onClick={() => onSymbolChange?.(card.symbol)}
                    className={`rounded-md px-2 py-2 text-center border transition-colors ${cardTheme.row} hover:border-blue-700/40`}
                  >
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{shortSym(card.symbol)}</div>
                    <div className={`text-[11px] font-semibold ${cardTheme.text}`}>{card.stance}</div>
                    <div className="text-[10px] text-slate-400">{fmtSigned(card.score, 2)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
