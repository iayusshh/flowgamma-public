import { memo, useState } from 'react';

const W = 300, H = 100;
const PAD = { l: 8, r: 8, t: 8, b: 22 };

function GexChart({ gex }) {
  const [showInfo, setShowInfo] = useState(false);
  const [hover, setHover] = useState(null); // { strike, gex, x, y }

  if (!gex) {
    return (
      <div className="panel p-4 animate-pulse">
        <div className="panel-label">GEX</div>
        <div className="h-20 bg-[#1e2d3d] rounded mt-4" />
      </div>
    );
  }

  const {
    gex_by_strike,
    gamma_flip,
    max_gex_strike,
    spot,
    spot_above_flip,
    interpretation,
    total_gex,
    gamma_flip_confidence,
    gex_distribution_diagnostics,
  } = gex;
  const data = gex_by_strike || [];

  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  const maxAbs = Math.max(...data.map(d => Math.abs(d.net_gex)), 1);
  const strikes = data.map(d => d.strike);
  const sMin = strikes.length ? Math.min(...strikes) : 0;
  const sMax = strikes.length ? Math.max(...strikes) : 1;

  const n = data.length || 1;
  const barW = Math.max((cw / n) * 0.7, 1);
  const sx = s => PAD.l + (sMax === sMin ? cw / 2 : ((s - sMin) / (sMax - sMin)) * cw);
  const midY = PAD.t + ch / 2;
  const bh = v => (Math.abs(v) / maxAbs) * (ch / 2 - 1);

  const spotX = spot && sMax > sMin ? sx(spot) : null;
  const flipX = gamma_flip && sMax > sMin ? sx(gamma_flip) : null;
  const maxX = max_gex_strike && sMax > sMin ? sx(max_gex_strike) : null;

  // Tick labels: show ~4 evenly spaced strikes
  const tickSteps = Math.max(1, Math.floor(n / 4));
  const tickStrikes = data.filter((_, i) => i % tickSteps === 0 || i === n - 1);

  const fmtGex = v => {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
    if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return String(v);
  };

  return (
    <div className="panel p-4">
      <div className="panel-header -mx-4 -mt-4 mb-3">
        <span className="panel-label">GEX</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold ${spot_above_flip ? 'text-green-500' : 'text-red-400'}`}>
            {spot_above_flip ? '▣ DAMPENING' : '◈ AMPLIFYING'}
          </span>
          <button className="info-btn" onClick={() => setShowInfo(v => !v)}>
            {showInfo ? '▴ hide' : 'ℹ calc'}
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = (e.clientX - rect.left) * (W / rect.width);
          const my = (e.clientY - rect.top) * (H / rect.height);
          let nearest = null, minDist = Infinity;
          data.forEach(d => {
            const dist = Math.abs(sx(d.strike) - mx);
            if (dist < minDist) { minDist = dist; nearest = d; }
          });
          if (nearest && minDist < barW * 3) {
            setHover({ strike: nearest.strike, gex: nearest.net_gex, x: sx(nearest.strike), y: my });
          } else {
            setHover(null);
          }
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Zero line */}
        <line x1={PAD.l} y1={midY} x2={W - PAD.r} y2={midY} stroke="#1e2d3d" strokeWidth="0.5" />

        {/* Bars */}
        {data.map((d, i) => {
          const bx = sx(d.strike);
          const barHeight = bh(d.net_gex);
          const pos = d.net_gex >= 0;
          const isHovered = hover?.strike === d.strike;
          return (
            <rect
              key={d.strike}
              x={bx - barW / 2}
              y={pos ? midY - barHeight : midY}
              width={barW}
              height={Math.max(barHeight, 0.5)}
              fill={isHovered ? (pos ? '#22c55e70' : '#ef444470') : (pos ? '#22c55e40' : '#ef444440')}
              stroke={pos ? '#22c55e' : '#ef4444'}
              strokeWidth={isHovered ? 0.8 : 0.4}
              style={{ animation: `gex-bar-in 0.3s ease-out ${i * 15}ms both` }}
            />
          );
        })}

        {/* Max GEX marker (pin level) */}
        {maxX && (
          <line x1={maxX} y1={PAD.t} x2={maxX} y2={midY} stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2,2" />
        )}

        {/* Spot line */}
        {spotX && (
          <line x1={spotX} y1={PAD.t} x2={spotX} y2={H - PAD.b} stroke="#f59e0b" strokeWidth="1.2" />
        )}

        {/* Gamma flip line */}
        {flipX && (
          <line x1={flipX} y1={PAD.t} x2={flipX} y2={H - PAD.b} stroke="#a855f7" strokeWidth="1.2" strokeDasharray="3,2" />
        )}

        {/* Strike tick labels */}
        {tickStrikes.map(d => (
          <text key={d.strike} x={sx(d.strike)} y={H - 2} textAnchor="middle" fill="#374151" fontSize="4.5" fontFamily="monospace">
            {d.strike}
          </text>
        ))}

        {/* GEX value labels (spot & flip) */}
        {spotX && (
          <text x={spotX + 1.5} y={PAD.t + 7} fill="#f59e0b" fontSize="4.5" fontFamily="monospace">S</text>
        )}
        {flipX && (
          <text x={flipX + 1.5} y={PAD.t + 7} fill="#a855f7" fontSize="4.5" fontFamily="monospace">γF</text>
        )}

        {/* Hover tooltip */}
        {hover && (() => {
          const tx = Math.min(hover.x + 3, W - 62);
          const ty = Math.max(hover.y - 20, PAD.t + 2);
          const pos = hover.gex >= 0;
          return (
            <g>
              <line x1={hover.x} y1={PAD.t} x2={hover.x} y2={H - PAD.b} stroke="#475569" strokeWidth="0.5" strokeDasharray="2,2" />
              <rect x={tx} y={ty} width={59} height={14} rx="2" fill="#0a0f18" stroke="#1e2d3d" strokeWidth="0.5" opacity="0.95" />
              <text x={tx + 3} y={ty + 5.5} fill="#94a3b8" fontSize="4.5" fontFamily="monospace">{hover.strike}</text>
              <text x={tx + 3} y={ty + 11} fill={pos ? '#22c55e' : '#ef4444'} fontSize="4.5" fontFamily="monospace">{fmtGex(hover.gex)}</text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
        <span className="text-green-500">■ +GEX</span>
        <span className="text-red-400">■ −GEX</span>
        {gamma_flip && <span className="text-purple-400">╌ γFlip {gamma_flip?.toFixed(0)}</span>}
        {spot && <span className="text-amber-400">│ Spot {spot.toFixed(0)}</span>}
        {total_gex != null && (
          <span className="text-slate-600">Total {fmtGex(total_gex)}</span>
        )}
      </div>

      {/* Gamma Flip regime — always visible */}
      {gamma_flip && (
        <div className="mt-2 p-2 rounded text-[9px]" style={{ background: '#0a0f18', border: '1px solid #2d1f5e' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-purple-400 font-semibold">γ Flip: {gamma_flip.toFixed(0)}</span>
            <span className={`font-semibold ${spot_above_flip ? 'text-green-500' : 'text-red-400'}`}>
              {spot_above_flip ? '▣ DAMPENING' : '◈ AMPLIFYING'}
            </span>
          </div>
          <div className="text-slate-600 leading-relaxed">
            {spot_above_flip
              ? 'Spot above flip → Dealers BUY dips / SELL rallies → range-bound, vol suppressed. Pin near max-GEX strike.'
              : 'Spot below flip → Dealers SELL dips / BUY rallies → momentum amplified, vol expanding. Trend-follow mode.'}
          </div>
          <div className="text-slate-700 mt-1">
            Cross <span className="text-red-400">DOWN</span> through flip = vol expands (most actionable).
            Cross <span className="text-green-500">UP</span> = vol contracts, rally may stall.
          </div>
        </div>
      )}

      {/* Interpretation */}
      <div className="mt-2 text-[10px] text-slate-500 leading-relaxed line-clamp-2">
        {interpretation}
      </div>

      <div className="mt-2 rounded border border-slate-800 bg-slate-950/40 p-2 text-[10px] text-slate-400">
        <div className="text-slate-500 mb-1">Gamma Flip Quality</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <span>Confidence</span>
          <span className="text-right">{gamma_flip_confidence != null ? (gamma_flip_confidence * 100).toFixed(0) + '%' : '--'}</span>
          <span>Far OTM Share</span>
          <span className="text-right">{gex_distribution_diagnostics?.far_otm_share != null ? (gex_distribution_diagnostics.far_otm_share * 100).toFixed(1) + '%' : '--'}</span>
          <span>OI Coverage</span>
          <span className="text-right">{gex_distribution_diagnostics?.oi_coverage != null ? (gex_distribution_diagnostics.oi_coverage * 100).toFixed(1) + '%' : '--'}</span>
          <span>Snapshot Age</span>
          <span className="text-right">{gex_distribution_diagnostics?.snapshot_age_seconds != null ? `${gex_distribution_diagnostics.snapshot_age_seconds}s` : '--'}</span>
        </div>
      </div>

      {showInfo && (
        <div className="inference-box mt-3 space-y-2">
          <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">GEX Calculation</div>
          <div className="code-block text-slate-500">
            <div>CallGEX = activity × γ × spot² × 0.01 × lot</div>
            <div>PutGEX  = −1 × activity × γ × spot² × 0.01 × lot</div>
            <div>NetGEX  = CallGEX + PutGEX per strike</div>
            <div className="text-slate-700">activity = OI if &gt;0, else Volume</div>
          </div>

          <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold pt-1">Gamma Flip — What &amp; How</div>
          <div>
            <span className="text-purple-400">γ Flip</span> = the price level where net GEX crosses zero.
            Found by linear interpolation between the two adjacent strikes that bracket the zero-crossing.
          </div>

          <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold pt-1">Regimes</div>
          <div>
            <span className="text-green-500">Spot ABOVE flip (+GEX regime)</span>
            <div className="text-slate-600 ml-2">
              Dealers are net long gamma. To delta-hedge they BUY dips and SELL rallies.
              Effect: price oscillates, volatility is suppressed. Market tends to pin near the max-GEX strike.
              <br/>Strategy: mean-reversion, sell straddles, fade breakouts.
            </div>
          </div>
          <div>
            <span className="text-red-400">Spot BELOW flip (−GEX regime)</span>
            <div className="text-slate-600 ml-2">
              Dealers are net short gamma. To delta-hedge they SELL dips and BUY rallies — momentum-reinforcing.
              Effect: moves accelerate, volatility expands.
              <br/>Strategy: trend-follow, widen stops, avoid naked option selling.
            </div>
          </div>

          <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold pt-1">When Price Crosses the Flip</div>
          <div>
            <span className="text-amber-400">Cross UP through flip</span>
            <span className="text-slate-600"> (−GEX → +GEX): dealer hedging flips from momentum to mean-reverting.
            Volatility tends to contract. Rallies may stall. Often a short-term top signal intraday.</span>
          </div>
          <div>
            <span className="text-red-400">Cross DOWN through flip</span>
            <span className="text-slate-600"> (+GEX → −GEX): dealer hedging turns momentum-following.
            Volatility expands rapidly. High probability of a trending/accelerating move.
            This is the most actionable signal — consider adding to directional positions.</span>
          </div>

          <div className="text-slate-700 text-[9px] pt-1">
            Max GEX strike (amber ╌) = gravitational pin level when in +GEX regime.
            Price often gets "stuck" there near expiry as dealer hedging creates equilibrium.
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(GexChart);
