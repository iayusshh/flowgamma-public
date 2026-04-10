import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

const IST_OFFSET_SEC = 5.5 * 3600; // +5:30

// lightweight-charts passes UTC seconds as-is to tickMarkFormatter/timeFormatter.
// We just need to display them in IST — new Date(sec*1000) is already UTC-based,
// so passing timeZone:'Asia/Kolkata' to toLocaleString is sufficient.
function toSec(time) {
  if (typeof time === 'number') return time;
  if (time && typeof time === 'object' && 'year' in time && 'month' in time && 'day' in time) {
    return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
  }
  return null;
}

function fmtIstForAxis(sec) {
  // sec is UTC seconds — convert to IST for axis tick labels
  return new Date(sec * 1000).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function fmtIstFromSec(sec) {
  // sec is UTC seconds — format full date+time in IST for tooltip
  return new Date(sec * 1000).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' IST';
}

export default function HistoryXYChart({
  points,
  stroke = '#22c55e',
  topFill = 'rgba(34,197,94,0.28)',
  bottomFill = 'rgba(34,197,94,0.05)',
  valueFormat,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#020617' },
        textColor: '#64748b',
        attributionLogo: false,
        fontFamily: 'SF Mono, Fira Code, Cascadia Code, monospace',
        fontSize: 10,
      },
      localization: {
        locale: 'en-IN',
        // timeFormatter controls the crosshair time label popup
        timeFormatter: (time) => {
          const sec = toSec(time);
          if (!sec) return '';
          return fmtIstFromSec(sec);
        },
        // dateFormatter controls date display in axis when zoomed out
        dateFormatter: (time) => {
          const sec = toSec(time);
          if (!sec) return '';
          return new Date(sec * 1000).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
          });
        },
      },
      width: containerRef.current.clientWidth,
      height: 240,
      grid: {
        vertLines: { color: '#1e293b', style: LineStyle.Dotted },
        horzLines: { color: '#1e293b', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#64748b', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0f172a' },
        horzLine: { color: '#475569', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0f172a' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time) => {
          const sec = toSec(time);
          if (!sec) return '';
          return fmtIstForAxis(sec);
        },
      },
    });

    const series = chart.addAreaSeries({
      lineColor: stroke,
      lineWidth: 2,
      topColor: topFill,
      bottomColor: bottomFill,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
    });

    chart.subscribeCrosshairMove((param) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      const data = param.seriesData?.get(series);
      if (!param.time || !data) {
        tip.style.display = 'none';
        return;
      }
      const sec = toSec(param.time);
      if (!sec) {
        tip.style.display = 'none';
        return;
      }
      const val = data.value;
      const valueText = valueFormat ? valueFormat(val) : String(val);
      tip.style.display = 'block';
      tip.innerText = `${fmtIstFromSec(sec)}\nValue ${valueText}`;
      const x = Math.min(Math.max((param.point?.x ?? 0) + 16, 8), (containerRef.current?.clientWidth || 0) - 170);
      const y = Math.min(Math.max((param.point?.y ?? 0) - 36, 8), 200);
      tip.style.transform = `translate(${x}px, ${y}px)`;
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      chartRef.current.timeScale().fitContent();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [stroke, topFill, bottomFill, valueFormat]);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data = (points || []).map((p) => ({
      time: Math.floor(p.t / 1000),
      value: p.v,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  if (!points?.length) {
    return (
      <div className="h-60 rounded border border-slate-800 bg-slate-950/40 flex items-center justify-center text-[11px] text-slate-500">
        No data in selected window
      </div>
    );
  }

  return (
    <div className="relative rounded border border-slate-800 bg-slate-950/40 overflow-hidden">
      <div ref={containerRef} className="w-full h-60" />
      <div
        ref={tooltipRef}
        className="absolute hidden whitespace-pre rounded border border-slate-700 bg-slate-950/95 px-2 py-1 text-[10px] text-slate-200 pointer-events-none"
      />
    </div>
  );
}
