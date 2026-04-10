import { memo, useState } from 'react';

// Map -1..+1 to angle 200..340 degrees (arc from bottom-left to bottom-right)
function normalizedToAngle(n) {
  return 200 + (n + 1) * 0.5 * 140; // 200° (full bear) to 340° (full bull)
}

function polarToXY(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function DeltaGauge({ delta }) {
  const [showInfo, setShowInfo] = useState(false);

  if (!delta) {
    return (
      <div className="panel p-4 animate-pulse">
        <div className="panel-label">Net Delta</div>
        <div className="w-32 h-16 bg-[#1e2d3d] rounded mx-auto mt-4" />
      </div>
    );
  }

  const { normalized, direction, change, net_delta } = delta;
  const clampedN = Math.max(-1, Math.min(1, normalized ?? 0));
  const angle = normalizedToAngle(clampedN);
  const color = direction === 'BULLISH' ? '#22c55e' : direction === 'BEARISH' ? '#ef4444' : '#f59e0b';

  // Gauge arc params
  const cx = 90, cy = 80, R = 60;
  const startAngle = 200, endAngle = 340;

  // Arc path helper
  const describeArc = (start, end) => {
    const s = polarToXY(cx, cy, R, start);
    const e = polarToXY(cx, cy, R, end);
    const large = end - start > 180 ? 1 : 0;
    return `M${s.x.toFixed(1)},${s.y.toFixed(1)} A${R},${R} 0 ${large},1 ${e.x.toFixed(1)},${e.y.toFixed(1)}`;
  };

  // Needle tip
  const needle = polarToXY(cx, cy, R - 8, angle);
  const needleBase1 = polarToXY(cx, cy, 6, angle + 90);
  const needleBase2 = polarToXY(cx, cy, 6, angle - 90);

  return (
    <div className="panel p-4">
      <div className="panel-header -mx-4 -mt-4 mb-3">
        <span className="panel-label">Net Delta</span>
        <button className="info-btn" onClick={() => setShowInfo(v => !v)}>
          {showInfo ? '▴ hide' : 'ℹ calc'}
        </button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <svg width="180" height="110" viewBox="0 0 180 110">
          {/* Track arc (gray) */}
          <path d={describeArc(startAngle, endAngle)} fill="none" stroke="#1e2d3d" strokeWidth="8" strokeLinecap="round" />
          {/* Filled arc up to current value */}
          {clampedN !== 0 && (
            <path
              d={describeArc(clampedN > 0 ? 270 : angle, clampedN > 0 ? angle : 270)}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
            />
          )}
          {/* Zone labels */}
          <text x="22" y="98" fill="#ef4444" fontSize="9" fontFamily="monospace">Bear</text>
          <text x="150" y="98" fill="#22c55e" fontSize="9" fontFamily="monospace">Bull</text>
          <text x={cx} y="95" textAnchor="middle" fill="#374151" fontSize="8" fontFamily="monospace">0</text>

          {/* Needle */}
          <polygon
            points={`${needle.x.toFixed(1)},${needle.y.toFixed(1)} ${needleBase1.x.toFixed(1)},${needleBase1.y.toFixed(1)} ${needleBase2.x.toFixed(1)},${needleBase2.y.toFixed(1)}`}
            fill={color}
            style={{ transition: 'all 0.5s ease' }}
          />
          <circle cx={cx} cy={cy} r="5" fill={color} />

          {/* Value */}
          <text x={cx} y={cy - 12} textAnchor="middle" fill={color} fontSize="16" fontWeight="700" fontFamily="monospace">
            {clampedN >= 0 ? '+' : ''}{(clampedN * 100).toFixed(1)}
          </text>
        </svg>

        {/* Direction badge */}
        <div className="flex items-center gap-3 text-[11px]">
          <span style={{ color }} className="font-semibold">{direction}</span>
          {change != null && (
            <span className="text-slate-600">
              Δ {change >= 0 ? '+' : ''}{(change * 100).toFixed(2)} vs prev
            </span>
          )}
        </div>
      </div>

      {showInfo && (
        <div className="inference-box mt-3">
          <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">Net Delta Exposure</div>
          <div className="code-block text-slate-500">
            <div>net = Σ(activity × delta)</div>
            <div>norm = net / total_activity</div>
            <div className="text-slate-700">activity = OI if &gt;0, else Volume</div>
          </div>
          <div>
            CE delta is positive (0→1) · PE delta is negative (-1→0)
          </div>
          <div>
            <span className="text-green-500">norm &gt; 0.05</span> = Bullish &nbsp;
            <span className="text-red-500">norm &lt; −0.05</span> = Bearish
          </div>
          <div className="text-slate-600">
            Net positive = call activity dominates = bullish tilt.
            The CHANGE between snapshots is the real signal.
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(DeltaGauge);
