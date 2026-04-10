import { memo, useState } from 'react';

const W = 300, H = 100;
const PAD = { l: 32, r: 8, t: 10, b: 22 };

function polyline(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

function IvSkewChart({ skew }) {
  const [showInfo, setShowInfo] = useState(false);
  const [crosshair, setCrosshair] = useState(null); // { x, ceIv, peIv, strike }

  if (!skew) {
    return (
      <div className="panel p-4 animate-pulse">
        <div className="panel-label">IV Skew</div>
        <div className="h-20 bg-[#1e2d3d] rounded mt-4" />
      </div>
    );
  }

  const {
    skew_curve, atm_strike, atm_skew, delta_25_skew,
    interpretation, atm_ce_iv, atm_pe_iv,
  } = skew;

  const refSkew = delta_25_skew ?? atm_skew ?? 0;
  const skewColor = refSkew > 5 ? '#ef4444' : refSkew > 3 ? '#f59e0b' : refSkew > 0 ? '#94a3b8' : '#22c55e';

  // Filter valid curve points
  const curve = (skew_curve || []).filter(p => p.ce_iv > 0 && p.pe_iv > 0);
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  const allIVs = curve.flatMap(p => [p.ce_iv, p.pe_iv]);
  const ivMin = allIVs.length ? Math.min(...allIVs) * 0.9 : 0;
  const ivMax = allIVs.length ? Math.max(...allIVs) * 1.1 : 30;
  const strikes = curve.map(p => p.strike);
  const sMin = strikes.length ? Math.min(...strikes) : 0;
  const sMax = strikes.length ? Math.max(...strikes) : 1;

  const sx = s => PAD.l + (sMax === sMin ? cw / 2 : ((s - sMin) / (sMax - sMin)) * cw);
  const sy = iv => PAD.t + ch - ((iv - ivMin) / ((ivMax - ivMin) || 1)) * ch;

  const cePoints = curve.map(p => [sx(p.strike), sy(p.ce_iv)]);
  const pePoints = curve.map(p => [sx(p.strike), sy(p.pe_iv)]);
  const atmX = atm_strike && sMax > sMin ? sx(atm_strike) : PAD.l + cw / 2;

  // Y-axis ticks (3 values)
  const yTicks = [ivMin, (ivMin + ivMax) / 2, ivMax];

  return (
    <div className="panel p-4">
      <div className="panel-header -mx-4 -mt-4 mb-3">
        <span className="panel-label">IV Skew</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold" style={{ color: skewColor }}>
            {refSkew >= 0 ? '+' : ''}{refSkew.toFixed(2)}%
          </span>
          <button className="info-btn" onClick={() => setShowInfo(v => !v)}>
            {showInfo ? '▴ hide' : 'ℹ calc'}
          </button>
        </div>
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseMove={(e) => {
          if (!curve.length) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = (e.clientX - rect.left) * (W / rect.width);
          let nearest = null, minDist = Infinity;
          curve.forEach(p => {
            const dist = Math.abs(sx(p.strike) - mx);
            if (dist < minDist) { minDist = dist; nearest = p; }
          });
          if (nearest) {
            setCrosshair({ x: sx(nearest.strike), ceIv: nearest.ce_iv, peIv: nearest.pe_iv, strike: nearest.strike });
          }
        }}
        onMouseLeave={() => setCrosshair(null)}
      >
        {/* Grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={sy(v)} x2={W - PAD.r} y2={sy(v)} stroke="#1a2332" strokeWidth="0.5" />
            <text x={PAD.l - 3} y={sy(v) + 3} textAnchor="end" fill="#374151" fontSize="5" fontFamily="monospace">
              {v.toFixed(0)}
            </text>
          </g>
        ))}

        {/* ATM vertical */}
        <line x1={atmX} y1={PAD.t} x2={atmX} y2={PAD.t + ch} stroke="#374151" strokeWidth="0.5" strokeDasharray="2,2" />
        <text x={atmX} y={H - 2} textAnchor="middle" fill="#374151" fontSize="5" fontFamily="monospace">ATM</text>

        {/* CE line (blue) */}
        {cePoints.length > 1 && (
          <path d={polyline(cePoints)} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
        )}
        {/* PE line (purple) */}
        {pePoints.length > 1 && (
          <path d={polyline(pePoints)} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round" />
        )}

        {/* ATM dots */}
        {atm_ce_iv > 0 && <circle cx={atmX} cy={sy(atm_ce_iv)} r="2" fill="#3b82f6" />}
        {atm_pe_iv > 0 && <circle cx={atmX} cy={sy(atm_pe_iv)} r="2" fill="#a855f7" />}

        {/* X-axis labels (first + last + atm) */}
        {[curve[0], curve[curve.length - 1]].filter(Boolean).map((p, i) => (
          <text key={i} x={sx(p.strike)} y={H - 2} textAnchor="middle" fill="#374151" fontSize="4.5" fontFamily="monospace">
            {p.strike}
          </text>
        ))}

        {/* Interactive crosshair */}
        {crosshair && (() => {
          const tx = Math.min(crosshair.x + 3, W - 66);
          return (
            <g>
              <line x1={crosshair.x} y1={PAD.t} x2={crosshair.x} y2={PAD.t + ch} stroke="#475569" strokeWidth="0.5" />
              <circle cx={crosshair.x} cy={sy(crosshair.ceIv)} r="2" fill="#3b82f6" />
              <circle cx={crosshair.x} cy={sy(crosshair.peIv)} r="2" fill="#a855f7" />
              <rect x={tx} y={PAD.t + 1} width={63} height={18} rx="2" fill="#0a0f18" stroke="#1e2d3d" strokeWidth="0.5" opacity="0.95" />
              <text x={tx + 3} y={PAD.t + 7} fill="#94a3b8" fontSize="4" fontFamily="monospace">{crosshair.strike}</text>
              <text x={tx + 3} y={PAD.t + 12} fill="#3b82f6" fontSize="4.5" fontFamily="monospace">CE {crosshair.ceIv.toFixed(1)}%</text>
              <text x={tx + 33} y={PAD.t + 12} fill="#a855f7" fontSize="4.5" fontFamily="monospace">PE {crosshair.peIv.toFixed(1)}%</text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex gap-3 mt-1 text-[10px]">
        <span className="text-blue-400">━ CE IV</span>
        <span className="text-purple-400">━ PE IV</span>
        {delta_25_skew != null && (
          <span className="text-slate-500">
            25Δ: <span style={{ color: skewColor }}>{delta_25_skew >= 0 ? '+' : ''}{delta_25_skew.toFixed(2)}</span>
          </span>
        )}
        {atm_ce_iv > 0 && atm_pe_iv > 0 && (
          <span className="text-slate-600">ATM CE:{atm_ce_iv.toFixed(1)} PE:{atm_pe_iv.toFixed(1)}</span>
        )}
      </div>

      {/* Interpretation */}
      <div className="mt-2 text-[10px] text-slate-500 leading-relaxed line-clamp-2">
        {interpretation}
      </div>

      {showInfo && (
        <div className="inference-box mt-3">
          <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">IV Skew Calculation</div>
          <div className="code-block text-slate-500">
            <div>skew = PE_IV − CE_IV</div>
            <div className="text-slate-700">(at equidistant strikes from ATM)</div>
            <div>25Δ skew: −0.25 delta put IV minus +0.25 delta call IV</div>
          </div>
          <div>Normal equity skew: PE IV &gt; CE IV by 1−3% (structural)</div>
          <div>
            <span className="text-red-500">&gt;5%</span> = crash hedging &nbsp;
            <span className="text-amber-500">3−5%</span> = cautious &nbsp;
            <span className="text-green-500">&lt;0%</span> = call demand (rare bull)
          </div>
          <div className="text-slate-600">
            The CHANGE in skew over time is the signal — widening skew = institutions suddenly hedging.
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(IvSkewChart);
