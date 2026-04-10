import { useMemo, useState } from 'react';
import HistoryXYChart from './HistoryXYChart';

const TABS = [
  { key: 'conviction', label: 'Conviction' },
  { key: 'oi', label: 'OI Buildup' },
  { key: 'scan', label: 'Scan' },
  { key: 'iv', label: 'IV Skew' },
  { key: 'gex', label: 'GEX' },
];

const WINDOWS = [
  { key: '5m', label: '5', sec: 5 * 60 },
  { key: '15m', label: '15', sec: 15 * 60 },
  { key: '1h', label: '1H', sec: 60 * 60 },
  { key: '4h', label: '4H', sec: 4 * 60 * 60 },
  { key: '1d', label: '1D', sec: 24 * 60 * 60 },
];

function formatIST(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + ' IST';
}

function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '--';
  if (Math.abs(n) >= 1_000_000) return n.toExponential(2);
  return n.toFixed(4).replace(/\.?0+$/, '');
}

function parseTimeMs(value) {
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) ? t : null;
}

function asFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function aggregateByBucket(points, bucketSec) {
  if (!points.length) return [];
  const grouped = new Map();
  const bucketMs = bucketSec * 1000;

  points.forEach((p) => {
    const bucketStart = Math.floor(p.t / bucketMs) * bucketMs;
    const g = grouped.get(bucketStart) || { sum: 0, count: 0 };
    g.sum += p.v;
    g.count += 1;
    grouped.set(bucketStart, g);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, g]) => ({ t, v: g.sum / Math.max(1, g.count) }));
}

function HistorySkeleton() {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/40 p-3 animate-pulse">
      <div className="h-4 w-40 bg-slate-800 rounded mb-3" />
      <div className="h-44 bg-slate-900/70 rounded" />
      <div className="mt-3 h-3 w-56 bg-slate-800 rounded" />
    </div>
  );
}

function interpretationFor(tab) {
  if (tab === 'conviction') {
    return {
      what: 'Composite directional score from all 5 engines. Positive means bullish tilt, negative means bearish tilt.',
      read: 'Rising above zero = strengthening long bias. Falling below zero = strengthening short bias. Flat near zero = no clear edge.',
      caution: 'Use slope + persistence across buckets, not one isolated spike.'
    };
  }
  if (tab === 'oi') {
    return {
      what: 'Bullish strike count minus bearish strike count from OI buildup classification.',
      read: 'Above zero = more long buildup/put-writing structure. Below zero = more short buildup/call-writing structure.',
      caution: 'OI changes are strongest near ATM and high-liquidity strikes; ignore tiny moves at illiquid wings.'
    };
  }
  if (tab === 'scan') {
    return {
      what: 'Count of unusual flow events flagged by the smart-money scanner in each bucket.',
      read: 'Higher bars mean participation/urgency increased. Pair direction with Conviction/OI to know if flow is supportive or hedging.',
      caution: 'A high count alone is not directional. Treat as activity intensity first.'
    };
  }
  if (tab === 'iv') {
    return {
      what: 'Skew value between put and call implied volatility structure.',
      read: 'Higher positive skew often means downside protection demand. Lower/negative skew can imply risk-on or call demand.',
      caution: 'Skew can stay elevated in volatile sessions; confirm with price + OI before acting.'
    };
  }
  return {
    what: 'Net gamma exposure proxy for dealer positioning regime.',
    read: 'More positive GEX usually dampens volatility (pin behavior). More negative GEX can amplify moves (trend-following hedging).',
    caution: 'Regime shifts are key. Watch for fast transitions instead of absolute level only.'
  };
}

export default function HistoryPanel({
  symbol,
  history,
  loading,
  schedulerTelemetry,
  title = 'History',
  defaultTab = 'conviction',
  lockedTab = null,
}) {
  const [tab, setTab] = useState(defaultTab);
  const [windowKey, setWindowKey] = useState('15m');

  const source = {
    conviction: history?.conviction?.data || [],
    oi: history?.oiBuildup?.data || [],
    scan: history?.scan?.data || [],
    iv: history?.ivSkew?.data || [],
    gex: history?.gex?.data || [],
  };

  const effectiveTab = lockedTab || tab;
  const rows = source[effectiveTab] || [];
  const selectedWindow = WINDOWS.find(w => w.key === windowKey) || WINDOWS[0];

  const points = useMemo(() => {
    const rawPoints = [];

    if (effectiveTab === 'conviction') {
      rows.forEach(r => {
        const t = parseTimeMs(r.captured_at || r.fetched_at);
        const v = asFiniteNumber(r.weighted_score);
        if (t != null && v != null) rawPoints.push({ t, v });
      });
    } else if (effectiveTab === 'oi') {
      rows.forEach(r => {
        const t = parseTimeMs(r.captured_at || r.fetched_at);
        const bull = asFiniteNumber(r.bullish_count);
        const bear = asFiniteNumber(r.bearish_count);
        if (t != null && bull != null && bear != null) rawPoints.push({ t, v: bull - bear });
      });
    } else if (effectiveTab === 'scan') {
      rows.forEach(r => {
        const t = parseTimeMs(r.captured_at || r.fetched_at);
        const v = asFiniteNumber(r.alert_count);
        if (t != null && v != null) rawPoints.push({ t, v });
      });
    } else if (effectiveTab === 'iv') {
      rows.forEach(r => {
        const t = parseTimeMs(r.captured_at || r.fetched_at);
        const v = asFiniteNumber(r.skew_value);
        if (t != null && v != null) rawPoints.push({ t, v });
      });
    } else {
      rows.forEach(r => {
        const t = parseTimeMs(r.captured_at || r.fetched_at);
        const v = asFiniteNumber(r.gex_total);
        if (t != null && v != null) rawPoints.push({ t, v });
      });
    }

    rawPoints.sort((a, b) => a.t - b.t);
    const aggregated = aggregateByBucket(rawPoints, selectedWindow.sec);
    const decimals = (effectiveTab === 'oi' || effectiveTab === 'scan') ? 0 : 4;
    const f = Math.pow(10, decimals);
    return aggregated.map(p => ({ ...p, v: Math.round(p.v * f) / f }));
  }, [rows, effectiveTab, selectedWindow.sec]);

  const colorMap = {
    conviction: { stroke: '#22c55e', top: 'rgba(34,197,94,0.28)', bottom: 'rgba(34,197,94,0.05)', title: 'Conviction Score' },
    oi: { stroke: '#eab308', top: 'rgba(234,179,8,0.28)', bottom: 'rgba(234,179,8,0.05)', title: 'OI Bias (Bull-Bear Count)' },
    scan: { stroke: '#0ea5e9', top: 'rgba(14,165,233,0.28)', bottom: 'rgba(14,165,233,0.05)', title: 'Unusual Scan Alerts' },
    iv: { stroke: '#a855f7', top: 'rgba(168,85,247,0.28)', bottom: 'rgba(168,85,247,0.05)', title: 'IV Skew Value' },
    gex: { stroke: '#f97316', top: 'rgba(249,115,22,0.28)', bottom: 'rgba(249,115,22,0.05)', title: 'Total GEX' },
  };

  const lastRow = rows.length ? rows[rows.length - 1] : null;
  const lastFetch = lastRow ? (lastRow.fetched_at || lastRow.captured_at) : null;
  const fixedRun = schedulerTelemetry?.fixed_indices?.last_run;
  const wlRun = schedulerTelemetry?.watchlist_symbols?.last_run;
  const activeRun = schedulerTelemetry?.active_symbol?.last_run;

  const minV = points.length ? Math.min(...points.map(p => p.v)) : null;
  const maxV = points.length ? Math.max(...points.map(p => p.v)) : null;
  const lastV = points.length ? points[points.length - 1].v : null;
  const interp = interpretationFor(effectiveTab);

  return (
    <div className="panel p-3 space-y-3 bg-gradient-to-b from-slate-950/80 to-slate-950/30 border border-slate-800/80 shadow-[0_0_0_1px_rgba(51,65,85,0.2)]">
      <div className="panel-header">
        <span className="panel-label">{title}</span>
        <span className="text-[10px] text-slate-500">{symbol}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded border border-slate-800/70 bg-slate-900/40 p-2">
        {!lockedTab && TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-2.5 py-1 rounded text-[10px] border transition-colors ${tab === t.key ? 'bg-emerald-900/60 text-emerald-200 border-emerald-600/60 shadow-[0_0_0_1px_rgba(16,185,129,0.2)_inset]' : 'bg-slate-800/40 text-slate-300 border-slate-700/60 hover:bg-slate-800/60'}`}
          >
            {t.label}
          </button>
        ))}
        {!lockedTab && <div className="w-px h-4 bg-slate-700 mx-1" />}
        {WINDOWS.map(w => (
          <button
            key={w.key}
            onClick={() => setWindowKey(w.key)}
            className={`px-2.5 py-1 rounded text-[10px] border transition-colors ${windowKey === w.key ? 'bg-blue-900/60 text-blue-200 border-blue-600/60 shadow-[0_0_0_1px_rgba(59,130,246,0.2)_inset]' : 'bg-slate-800/40 text-slate-300 border-slate-700/60 hover:bg-slate-800/60'}`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {loading ? (
        <HistorySkeleton />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-slate-300">{colorMap[effectiveTab].title}</div>
            <div className="text-[10px] text-slate-500">Bucket: {selectedWindow.label}</div>
          </div>
          <HistoryXYChart
            points={points}
            stroke={colorMap[effectiveTab].stroke}
            topFill={colorMap[effectiveTab].top}
            bottomFill={colorMap[effectiveTab].bottom}
            valueFormat={fmtNum}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
            <div className="rounded border border-slate-800/70 bg-slate-950/50 p-2 text-slate-400">Points: <span className="text-slate-200">{points.length}</span></div>
            <div className="rounded border border-slate-800/70 bg-slate-950/50 p-2 text-slate-400">Last: <span className="text-slate-200">{fmtNum(lastV)}</span></div>
            <div className="rounded border border-slate-800/70 bg-slate-950/50 p-2 text-slate-400">High: <span className="text-slate-200">{fmtNum(maxV)}</span></div>
            <div className="rounded border border-slate-800/70 bg-slate-950/50 p-2 text-slate-400">Low: <span className="text-slate-200">{fmtNum(minV)}</span></div>
          </div>
          <div className="text-[10px] text-slate-500">Last fetch: {formatIST(lastFetch)}</div>
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-[10px] text-slate-400">
          <div className="text-slate-500">Fixed Indices (5m)</div>
          <div>Last run: {formatIST(fixedRun?.ran_at)}</div>
          <div>Count: {fixedRun?.symbol_count ?? '--'}</div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-[10px] text-slate-400">
          <div className="text-slate-500">Watchlist (5m)</div>
          <div>Last run: {formatIST(wlRun?.ran_at)}</div>
          <div>Count: {wlRun?.symbol_count ?? '--'}</div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-[10px] text-slate-400">
          <div className="text-slate-500">Active Stock (5m)</div>
          <div>Last run: {formatIST(activeRun?.ran_at)}</div>
          <div>Symbol: {activeRun?.symbol || '--'}</div>
        </div>
      </div>

      <details className="rounded border border-slate-800 bg-slate-950/30 p-2" open>
        <summary className="cursor-pointer text-[10px] text-slate-300 font-semibold tracking-wide">
          How To Interpret This History View
        </summary>
        <div className="mt-2 grid gap-1 text-[10px] text-slate-400">
          <div><span className="text-slate-500">What it is:</span> {interp.what}</div>
          <div><span className="text-slate-500">How to read trend:</span> {interp.read}</div>
          <div><span className="text-slate-500">Caution:</span> {interp.caution}</div>
          <div>
            <span className="text-slate-500">Bucket guide:</span> 5/15 are execution-speed views, 1H/4H are structure views, 1D is regime view.
          </div>
        </div>
      </details>
    </div>
  );
}
