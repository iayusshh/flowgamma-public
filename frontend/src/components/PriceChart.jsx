import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

// ── Constants ────────────────────────────────────────────────────────────────
const TF_OPTIONS = [
  { value: 'd',  label: 'Daily' },
  { value: '60', label: '1H' },
  { value: '15', label: '15m' },
  { value: '5',  label: '5m' },
  { value: '3',  label: '3m' },
  { value: '1',  label: '1m' },
];
const TF_MAP = { d: 'daily', '60': 'hourly', '15': '15min', '5': '5min', '3': '3min', '1': '1min' };
const TF_SECONDS = { d: 86400, '60': 3600, '15': 900, '5': 300, '3': 180, '1': 60 };
const CHART_HEIGHT = 420;
const IST_OFFSET   = 19800; // UTC+5:30 in seconds
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── SVG element factory ──────────────────────────────────────────────────────
function mk(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function tickMarkFormatter(time, tickMarkType) {
  const d = new Date(time * 1000);
  if (tickMarkType === 3 || tickMarkType === 4)
    return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`;
  if (tickMarkType === 2) return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (tickMarkType === 1) return MONTHS[d.getUTCMonth()];
  return d.getUTCFullYear().toString();
}

function candleTs(c) {
  if (Array.isArray(c)) return c[0];
  return c.ts ?? c.timestamp ?? null;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PriceChart({ candles, technicals, gex, spot, timeframe, onTimeframeChange }) {
  const containerRef   = useRef(null);   // TradingView chart container
  const chartRef       = useRef(null);
  const seriesRef      = useRef(null);
  const srLinesRef     = useRef([]);
  const gexLineRef     = useRef(null);
  const sessionEndsRef = useRef([]);
  const svgRef         = useRef(null);   // session-end line overlay
  const legendRef      = useRef(null);   // OHLCV crosshair legend overlay
  const fitDoneRef        = useRef({});
  const redrawRef         = useRef(null);   // always-current redraw fn
  const lastFmtRef        = useRef([]);     // last formatted candles for spot synthesis
  const lastCandleCountRef = useRef(0);     // guard: skip setData when data unchanged
  const lastCandleTimeRef  = useRef(0);
  const lastSetDataAtRef   = useRef(0);
  const activeTfKey    = TF_MAP[timeframe] || 'daily';
  const activeTfData   = technicals?.timeframes?.[activeTfKey];
  const supportCount   = activeTfData?.supports?.length || 0;
  const resistanceCount = activeTfData?.resistances?.length || 0;
  const activeCandleCount = activeTfData?.candle_count || 0;
  const activeTrend = activeTfData?.trend || 'NO_DATA';

  // ── SVG redraw (session-end lines only) ──────────────────────────────────
  function redraw() {
    const svg   = svgRef.current;
    const chart = chartRef.current;
    if (!svg || !chart) return;

    // Clear existing session lines
    Array.from(svg.children).forEach(el => el.remove());

    const ts = chart.timeScale();
    const w  = containerRef.current?.clientWidth || 800;

    sessionEndsRef.current.forEach(t => {
      const x = ts.timeToCoordinate(t);
      if (x == null || x < 0 || x > w) return;
      svg.appendChild(mk('line', {
        x1:x, y1:0, x2:x, y2:CHART_HEIGHT,
        stroke:'#475569', 'stroke-width':1, 'stroke-dasharray':'3,4', opacity:'1',
      }));
    });
  }
  // Keep the ref up-to-date every render so subscriptions always call latest
  redrawRef.current = redraw;

  // ── Chart init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0d1117' },
        textColor: '#64748b',
        fontSize: 11,
        fontFamily: 'SF Mono, Fira Code, Cascadia Code, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#1a2332', style: LineStyle.Dotted },
        horzLines: { color: '#1a2332', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width:1, color:'#475569', style:LineStyle.Solid, labelBackgroundColor:'#1e293b' },
        horzLine: { width:1, color:'#334155', style:LineStyle.Dashed, labelBackgroundColor:'#1e293b' },
      },
      timeScale: {
        borderColor: '#1e2d3d',
        timeVisible: false,
        secondsVisible: false,
        rightOffset: 5,
        tickMarkFormatter,
      },
      rightPriceScale: {
        borderColor: '#1e2d3d',
        scaleMargins: { top: 0.06, bottom: 0.04 },
        autoScale: true,
      },
      width:  containerRef.current.clientWidth,
      height: CHART_HEIGHT,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e80', wickDownColor: '#ef444480',
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    // Hide TradingView logo
    setTimeout(() => {
      containerRef.current?.querySelectorAll('a').forEach(a => {
        if (a.href?.includes('tradingview')) a.style.cssText = 'display:none!important';
      });
    }, 300);

    // Redraw SVG overlay on pan/zoom — always via ref so it's never stale
    chart.timeScale().subscribeVisibleTimeRangeChange(() => redrawRef.current?.());

    // OHLCV crosshair legend — updates DOM directly (no React re-render)
    chart.subscribeCrosshairMove((param) => {
      const el = legendRef.current;
      if (!el) return;
      if (!param.time || !seriesRef.current) { el.style.display = 'none'; return; }
      const d = param.seriesData?.get(seriesRef.current);
      if (!d) { el.style.display = 'none'; return; }
      const o = d.open.toFixed(1);
      const h = d.high.toFixed(1);
      const l = d.low.toFixed(1);
      const c = d.close.toFixed(1);
      const chg = ((d.close - d.open) / d.open * 100);
      const color = d.close >= d.open ? '#22c55e' : '#ef4444';
      el.style.display = 'block';
      el.innerHTML =
        `<span style="color:#475569">O</span> ${o} &nbsp;` +
        `<span style="color:#475569">H</span> ${h} &nbsp;` +
        `<span style="color:#475569">L</span> ${l} &nbsp;` +
        `<span style="color:#475569">C</span> <span style="color:${color}">${c}</span> &nbsp;` +
        `<span style="color:${color}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>`;
    });

    // Resize observer
    const obs = new ResizeObserver(() => {
      if (chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        redrawRef.current?.();
      }
    });
    obs.observe(containerRef.current);

    return () => {
      obs.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
      srLinesRef.current = [];
      gexLineRef.current = null;
    };
  }, []);

  // ── Timeframe: show/hide time axis, reset fit + candle tracking ─────────
  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: { timeVisible: timeframe !== 'd', secondsVisible: false },
    });
    fitDoneRef.current[timeframe] = false;
    // Force setData on the next candle render for the new timeframe
    lastCandleCountRef.current = 0;
    lastCandleTimeRef.current  = 0;
    if (timeframe === 'd') { sessionEndsRef.current = []; redrawRef.current?.(); }
  }, [timeframe]);

  // ── Candles ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    if (!candles?.length) {
      seriesRef.current.setData([]);
      lastFmtRef.current        = [];
      lastCandleCountRef.current = 0;
      lastCandleTimeRef.current  = 0;
      sessionEndsRef.current    = [];
      redrawRef.current?.();
      return;
    }

    const fmt = candles.map(c => {
      const ts    = candleTs(c);
      const open  = Array.isArray(c) ? c[1] : c.open;
      const high  = Array.isArray(c) ? c[2] : c.high;
      const low   = Array.isArray(c) ? c[3] : c.low;
      const close = Array.isArray(c) ? c[4] : c.close;
      if (!ts || open == null || close == null) return null;
      return { time: ts + IST_OFFSET, open, high, low, close };
    }).filter(Boolean).sort((a, b) => a.time - b.time)
      .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);

    if (!fmt.length) return;

    const lastTime = fmt[fmt.length - 1].time;

    // If we already advanced further via live quote updates, ignore stale poll payloads.
    if (lastCandleTimeRef.current && lastTime < lastCandleTimeRef.current) {
      return;
    }

    // ── Guard: skip setData when the DB returned the same candles ────────
    // fetchCandles fires frequently. Calling setData repeatedly
    // with identical data corrupts the chart when series.update() is also
    // running concurrently for the live spot price.
    if (fmt.length === lastCandleCountRef.current && lastTime === lastCandleTimeRef.current) {
      lastFmtRef.current = fmt; // keep ref fresh (close values identical anyway)
      return;
    }

    lastCandleCountRef.current = fmt.length;
    lastCandleTimeRef.current  = lastTime;
    lastFmtRef.current         = fmt;

    // Session end lines (intraday only)
    if (timeframe !== 'd') {
      const SESSION_END_UTC_OFFSET = 36000;
      const daysSeen = new Set();
      fmt.forEach(c => {
        const dayUTC = Math.floor((c.time - IST_OFFSET) / 86400) * 86400;
        daysSeen.add(dayUTC);
      });
      sessionEndsRef.current = Array.from(daysSeen).map(d => d + SESSION_END_UTC_OFFSET + IST_OFFSET);
    } else {
      sessionEndsRef.current = [];
    }

    seriesRef.current.setData(fmt);
    lastSetDataAtRef.current = Date.now();

    if (!fitDoneRef.current[timeframe]) {
      try {
        chartRef.current?.timeScale().fitContent();
      } catch {
        // Retry on the next poll; lightweight-charts can throw if layout is mid-flight.
      }
      fitDoneRef.current[timeframe] = true;
    }

    setTimeout(() => redrawRef.current?.(), 80);
    setTimeout(() => redrawRef.current?.(), 400);
  }, [candles, timeframe]);

  // ── Spot price → live current candle ────────────────────────────────────
  // Build/update a realtime bar in the current timeframe bucket from spot.
  // Critical guard: if DB candles are stale, never mutate old historical bars.
  useEffect(() => {
    if (!seriesRef.current || !spot || timeframe === 'd') return;
    if (!Number.isFinite(spot)) return;
    if (Date.now() - lastSetDataAtRef.current < 120) return;

    const tfSec = TF_SECONDS[timeframe] || 60;
    const nowChart = Math.floor(Date.now() / 1000) + IST_OFFSET;
    const bucketTime = Math.floor(nowChart / tfSec) * tfSec;

    const fmt = lastFmtRef.current || [];
    const last = fmt.length ? fmt[fmt.length - 1] : null;

    let bar;
    if (!last || !last.time) {
      bar = { time: bucketTime, open: spot, high: spot, low: spot, close: spot };
      lastFmtRef.current = [bar];
    } else if (bucketTime <= last.time) {
      // Same bucket as latest bar → just update close/high/low.
      bar = {
        time: last.time,
        open: last.open,
        high: Math.max(last.high ?? spot, spot),
        low: Math.min(last.low ?? spot, spot),
        close: spot,
      };
      lastFmtRef.current[lastFmtRef.current.length - 1] = bar;
    } else {
      // New bucket: if source candles are stale, don't bridge gap from old close.
      const isStale = (nowChart - last.time) > (tfSec * 3);
      const open = isStale ? spot : (last.close ?? spot);
      bar = {
        time: bucketTime,
        open,
        high: Math.max(open, spot),
        low: Math.min(open, spot),
        close: spot,
      };
      lastFmtRef.current = [...lastFmtRef.current, bar];
      lastCandleCountRef.current = lastFmtRef.current.length;
      lastCandleTimeRef.current = bar.time;
    }

    try {
      seriesRef.current.update(bar);
    } catch {
      // TradingView throws if time ordering is violated (e.g. after a setData race).
      // Silently ignore — the chart will correct itself on the next setData call.
    }
  }, [spot, timeframe]);

  // ── S/R lines ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return;
    srLinesRef.current.forEach(l => { try { seriesRef.current.removePriceLine(l); } catch {} });
    srLinesRef.current = [];

    const tfData = technicals?.timeframes?.[TF_MAP[timeframe] || 'daily'];
    if (!tfData) return;

    const lines = [];
    (tfData.supports || []).forEach(d => {
      const price = d.level ?? d.price;
      if (!price) return;
      const strong = d.strength === 'STRONG';
      lines.push(seriesRef.current.createPriceLine({ price, color: strong ? '#22c55e80':'#22c55e40', lineWidth: strong?2:1, lineStyle:2, axisLabelVisible:true, title: strong?'S★':'S' }));
    });
    (tfData.resistances || []).forEach(d => {
      const price = d.level ?? d.price;
      if (!price) return;
      const strong = d.strength === 'STRONG';
      lines.push(seriesRef.current.createPriceLine({ price, color: strong ? '#ef444480':'#ef444440', lineWidth: strong?2:1, lineStyle:2, axisLabelVisible:true, title: strong?'R★':'R' }));
    });
    srLinesRef.current = lines;
  }, [technicals, timeframe]);

  // ── GEX flip line ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return;
    if (gexLineRef.current) { try { seriesRef.current.removePriceLine(gexLineRef.current); } catch {} gexLineRef.current = null; }
    if (!gex?.gamma_flip) return;
    gexLineRef.current = seriesRef.current.createPriceLine({
      price: gex.gamma_flip, color: '#a855f7', lineWidth:2, lineStyle:2,
      axisLabelVisible:true, title:'γ Flip',
    });
  }, [gex]);

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="panel flex flex-col" style={{ height: CHART_HEIGHT + 36 }}>

      {/* Header */}
      <div className="panel-header shrink-0">
        <span className="panel-label">Price Action</span>
        <div className="flex gap-1">
          {TF_OPTIONS.map(({ value, label }) => (
            <button key={value} onClick={() => onTimeframeChange(value)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${timeframe === value ? 'bg-blue-900/50 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-600">
          <span><span className="text-green-700">━━</span> S  <span className="text-red-900">━━</span> R</span>
          <span className="text-slate-700">
            {activeTfKey} · S {supportCount} · R {resistanceCount} · candles {activeCandleCount} · {activeTrend}
          </span>
          {gex?.gamma_flip ? (
            <span className="flex items-center gap-1">
              <span className="text-purple-400">γ Flip</span>
              <span className="text-purple-300 font-bold">{gex.gamma_flip.toFixed(0)}</span>
              <span className={gex.spot_above_flip ? 'text-green-400' : 'text-red-400'}>
                ● {gex.spot_above_flip ? 'DAMPENING' : 'AMPLIFYING'}
              </span>
              <span className="text-slate-600 text-[9px]">
                {gex.spot_above_flip
                  ? '· Spot above flip → dealers buy dips, pin mode'
                  : '· Spot below flip → dealers sell dips, trend-follow'}
              </span>
            </span>
          ) : (
            <span><span className="text-purple-500">╌</span> γFlip</span>
          )}
          <span className="text-slate-700">╎ Session</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ position:'relative', height: CHART_HEIGHT }}>
        <div ref={containerRef} style={{ width:'100%', height:CHART_HEIGHT }} />
        {!candles?.length && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 text-[11px] pointer-events-none">
            <span>No candle data</span>
            <span className="text-[9px] mt-1 text-slate-700">Run: python3 scripts/fyers_prefetch.py &lt;symbol&gt;</span>
          </div>
        )}

        {/* OHLCV crosshair legend */}
        <div ref={legendRef} style={{
          display: 'none',
          position: 'absolute', top: 8, left: 8, zIndex: 2,
          fontSize: 11, fontFamily: 'monospace',
          color: '#94a3b8',
          background: 'rgba(10,15,24,0.85)',
          borderRadius: 4, padding: '2px 8px',
          pointerEvents: 'none', lineHeight: 1.8,
          border: '1px solid #1e2d3d',
        }} />

        {/* SVG session-end line overlay */}
        <svg ref={svgRef}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible', pointerEvents:'none' }}
        />
      </div>
    </div>
    
  );
}
