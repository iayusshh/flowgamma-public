import { memo, useState } from 'react';

const WEIGHTS = {
  DELTA: 0.25,
  OI_BUILDUP: 0.25,
  UNUSUAL: 0.20,
  IV_SKEW: 0.15,
  GEX: 0.15,
};
const SIGNAL_LABELS = {
  DELTA: 'Net Delta',
  OI_BUILDUP: 'OI Buildup',
  UNUSUAL: 'Unusual',
  IV_SKEW: 'IV Skew',
  GEX: 'GEX',
};

function Skeleton() {
  return (
    <div className="panel p-4 flex flex-col gap-4 animate-pulse">
      <div className="panel-label">Conviction</div>
      <div className="w-24 h-24 rounded-full border-4 border-[#1e2d3d] mx-auto" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-4 bg-[#1e2d3d] rounded" />
      ))}
    </div>
  );
}

function ConvictionPanel({ conviction }) {
  const [showInfo, setShowInfo] = useState(false);

  if (!conviction) return <Skeleton />;

  const { direction, confidence, signal_breakdown, weighted_score, signals } = conviction;
  const isBull = direction === 'BULLISH';
  const isBear = direction === 'BEARISH';
  const color = isBull ? '#22c55e' : isBear ? '#ef4444' : '#f59e0b';

  // SVG arc progress
  const R = 42;
  const circ = 2 * Math.PI * R;
  const dash = (confidence / 100) * circ;

  const gexRegime = signals?.gex_regime || '—';
  const skewVal = signals?.iv_skew;

  return (
    <div className="panel p-4 flex flex-col gap-3 h-full">
      <div className="panel-header -mx-4 -mt-4 mb-0">
        <span className="panel-label">Conviction</span>
        <button className="info-btn" onClick={() => setShowInfo(v => !v)}>
          {showInfo ? '▴ hide' : 'ℹ how?'}
        </button>
      </div>

      {/* Score circle */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <svg width="108" height="108" viewBox="0 0 108 108">
          {/* Track */}
          <circle cx="54" cy="54" r={R} fill="none" stroke="#1e2d3d" strokeWidth="9" />
          {/* Progress */}
          <circle
            cx="54" cy="54" r={R} fill="none"
            stroke={color} strokeWidth="9"
            strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
            strokeLinecap="round"
            transform="rotate(-90 54 54)"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
          <text x="54" y="50" textAnchor="middle" fill={color} fontSize="20" fontWeight="700" fontFamily="monospace">
            {confidence}%
          </text>
          <text x="54" y="65" textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="monospace">
            {direction}
          </text>
        </svg>

        {/* Bar */}
        <div className="w-full h-0.5 bg-[#1e2d3d] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${confidence}%`, background: color }}
          />
        </div>
      </div>

      {/* Signal breakdown */}
      <div className="space-y-1.5 flex-1">
        {Object.entries(signal_breakdown || {}).map(([sig, vote]) => (
          <div key={sig} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-20">{SIGNAL_LABELS[sig] || sig}</span>
              <span className="text-slate-700 text-[9px]">{((WEIGHTS[sig] || 0) * 100).toFixed(0)}%</span>
            </div>
            <span className={`font-mono text-[11px] ${vote === 1 ? 'text-green-400' : vote === -1 ? 'text-red-400' : 'text-slate-600'}`}>
              {vote === 1 ? '▲ Bull' : vote === -1 ? '▼ Bear' : '— Neut'}
            </span>
          </div>
        ))}
      </div>

      {/* Context line */}
      <div className="text-[10px] text-slate-600 border-t border-[#1e2d3d] pt-2 space-y-0.5">
        <div>GEX regime: <span className={gexRegime === 'DAMPENING' ? 'text-green-600' : 'text-red-500'}>{gexRegime}</span></div>
        {skewVal != null && (
          <div>IV skew: <span className="text-slate-400">{skewVal >= 0 ? '+' : ''}{skewVal.toFixed(2)}%</span></div>
        )}
      </div>

      {/* Inference box */}
      {showInfo && (
        <div className="inference-box">
          <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">How Conviction is Calculated</div>
          <div>Each signal votes <span className="text-green-500">+1 Bull</span>, <span className="text-red-500">-1 Bear</span>, or <span className="text-slate-500">0 Neutral</span>, then multiplied by its weight:</div>
          <div className="code-block text-slate-500">
            <div>score = Σ(vote × weight)</div>
            <div className="text-slate-700">──────────────────────</div>
            <div>Net Delta   × 0.25</div>
            <div>OI Buildup  × 0.25</div>
            <div>Unusual     × 0.20</div>
            <div>IV Skew     × 0.15</div>
            <div>GEX         × 0.15</div>
            <div className="text-slate-700">──────────────────────</div>
            <div>score = <span className="text-blue-400">{weighted_score?.toFixed(3)}</span></div>
          </div>
          <div>
            <span className="text-green-500">BULLISH</span> if score &gt; 0.12 &nbsp;
            <span className="text-red-500">BEARISH</span> if score &lt; −0.12 &nbsp;
            <span className="text-amber-500">NEUTRAL</span> otherwise
          </div>
          <div>confidence = min(|score| / 0.85 × 100, 100)</div>
          <div className="text-amber-400">★ GEX amplifier: confidence × 1.3 when spot is below gamma flip (trending regime)</div>
        </div>
      )}
    </div>
  );
}

export default memo(ConvictionPanel);
