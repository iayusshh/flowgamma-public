import { memo, useState } from 'react';

function UnusualActivity({ data }) {
  const [showInfo, setShowInfo] = useState(false);
  const rows = data?.data || [];

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">
        <span className="panel-label">Unusual Activity</span>
        <button className="info-btn" onClick={() => setShowInfo(v => !v)}>
          {showInfo ? '▴ hide' : 'ℹ what is this?'}
        </button>
      </div>

      {showInfo && (
        <div className="mx-3 my-2 inference-box">
          <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">What is Unusual Activity?</div>
          <div>Strikes where volume is abnormally high — early signs of institutional positioning before a move.</div>
          <div className="code-block text-slate-500">
            <div>vol_ratio  = volume / median_volume (all strikes)</div>
            <div>hist_ratio = volume / 5-day avg at this strike</div>
            <div className="text-slate-700">Alert triggered if either ratio &gt; 3×</div>
          </div>
          <div>
            <span className="text-amber-400">OTM + high volume</span> = institutional (not retail scalping)
          </div>
          <div>
            Premium rising (<span className="text-green-500">BUYING</span>) = directional bet →
            someone expects the market to move that way
          </div>
          <div>
            Premium falling (<span className="text-red-400">WRITING</span>) = selling/capping →
            someone confident market stays away from that strike
          </div>
        </div>
      )}

      <div className="overflow-auto flex-1" style={{ maxHeight: 220 }}>
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 bg-panel z-10">
            <tr className="text-[9px] text-slate-600 uppercase border-b border-[#1a2332]">
              <th className="px-3 py-1.5 text-left">Strike</th>
              <th className="px-3 py-1.5 text-left">Side</th>
              <th className="px-3 py-1.5 text-right">×Med</th>
              <th className="px-3 py-1.5 text-right">OTM%</th>
              <th className="px-3 py-1.5 text-center">Activity</th>
              <th className="px-3 py-1.5 text-left">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-700 text-[11px]">
                  No unusual activity detected at this time
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const isBull = r.signal?.includes('BULLISH');
                const isBear = r.signal?.includes('BEARISH');
                const sigLabel = r.signal?.split(' — ')[0] || '—';
                return (
                  <tr
                    key={i}
                    className="border-t border-[#0f1923] hover:bg-[#0d1117]/70 transition-colors"
                  >
                    <td className="px-3 py-1.5 font-mono text-slate-300">{r.strike}</td>
                    <td className="px-3 py-1.5">
                      <span className={`text-[10px] font-bold ${r.side === 'CE' ? 'text-blue-400' : 'text-purple-400'}`}>
                        {r.side}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-amber-400 font-semibold">
                      {r.vol_vs_median}×
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-500">
                      {r.distance_pct?.toFixed(1)}%
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`text-[10px] font-semibold ${r.premium_direction === 'BUYING' ? 'text-green-500' : 'text-red-400'}`}>
                        {r.premium_direction === 'BUYING' ? '▲ BUY' : '▼ SELL'}
                      </span>
                    </td>
                    <td className={`px-3 py-1.5 text-[10px] ${isBull ? 'text-green-400' : isBear ? 'text-red-400' : 'text-slate-500'}`}>
                      {sigLabel}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {rows.length > 0 && (
        <div className="px-3 py-1.5 border-t border-[#1a2332] text-[9px] text-slate-700">
          Top {rows.length} alerts · sorted by vol × OTM distance
        </div>
      )}
    </div>
  );
}

export default memo(UnusualActivity);
