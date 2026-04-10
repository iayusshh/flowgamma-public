import { memo } from 'react';

const CAT = {
  LONG_BUILDUP:   { label: 'Long Build',   cls: 'bg-green-950/40 text-green-400' },
  SHORT_BUILDUP:  { label: 'Short Build',  cls: 'bg-red-950/40 text-red-400' },
  SHORT_COVERING: { label: 'Short Cover',  cls: 'bg-blue-950/40 text-blue-400' },
  LONG_UNWINDING: { label: 'Long Unwind',  cls: 'bg-amber-950/40 text-amber-400' },
  NEUTRAL:        { label: 'Neutral',      cls: 'bg-slate-800/30 text-slate-500' },
};

const SIG_CLS = {
  BULLISH:       'text-green-400',
  MILDLY_BULLISH:'text-green-600',
  BEARISH:       'text-red-400',
  MILDLY_BEARISH:'text-red-700',
  NEUTRAL:       'text-slate-600',
};

function OiBuildupTable({ data }) {
  const rows = data?.data || [];

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">
        <span className="panel-label">OI / Volume Buildup</span>
        {/* <span className="text-[9px] text-slate-700 italic">volume proxy — FYERS has no per-strike OI</span> */}
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1" style={{ maxHeight: 220 }}>
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 bg-panel z-10">
            <tr className="text-[9px] text-slate-600 uppercase border-b border-[#1a2332]">
              <th className="px-3 py-1.5 text-left">Strike</th>
              <th className="px-3 py-1.5 text-left">Side</th>
              <th className="px-3 py-1.5 text-left">Category</th>
              <th className="px-3 py-1.5 text-right">Δ%</th>
              <th className="px-3 py-1.5 text-right">ΔLTP</th>
              <th className="px-3 py-1.5 text-left">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-700 text-[11px]">
                  No buildup data — need 2+ snapshots captured
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const cat = CAT[r.category] || CAT.NEUTRAL;
                const sigCls = SIG_CLS[r.underlying_signal] || 'text-slate-600';
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
                    <td className="px-3 py-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-sm ${cat.cls}`}>{cat.label}</span>
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.oi_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {r.oi_change_pct >= 0 ? '+' : ''}{r.oi_change_pct.toFixed(1)}%
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.price_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {r.price_change >= 0 ? '+' : ''}{r.price_change.toFixed(2)}
                    </td>
                    <td className={`px-3 py-1.5 text-[10px] ${sigCls}`}>
                      {(r.underlying_signal || '').replace(/_/g, ' ')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-[#1a2332] flex flex-wrap gap-2 text-[9px]">
        <span className="text-green-900 bg-green-950/40 px-1 rounded">CE Long Build = Bull</span>
        <span className="text-red-900 bg-red-950/40 px-1 rounded">CE Short Build = Bear</span>
        <span className="text-purple-900 bg-purple-950/40 px-1 rounded">PE Long Build = Bear</span>
        <span className="text-blue-900 bg-blue-950/40 px-1 rounded">PE Short Build = Bull</span>
      </div>
    </div>
  );
}

export default memo(OiBuildupTable);
