import { useState, useRef, useEffect, useCallback } from 'react';

export default function SymbolSearch({ stocks = [], onSelect, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [collecting, setCollecting] = useState(null); // symbol being collected
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = query.length >= 1
    ? stocks.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.symbol.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    setOpen(results.length > 0);
    setHighlighted(0);
  }, [results.length]);

  const handleSelect = useCallback(async (stock) => {
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
    setCollecting(stock.symbol);
    try {
      await onSelect(stock.symbol);
    } finally {
      // Clear after ~90s (typical collection time)
      setTimeout(() => setCollecting(c => c === stock.symbol ? null : c), 90_000);
    }
  }, [onSelect]);

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlighted]) handleSelect(results[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (!inputRef.current?.closest('.symbol-search-root')?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="symbol-search-root relative flex items-center gap-2">
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={disabled ? 'Select watchlist first' : 'Search F&O stocks…'}
        disabled={disabled || !!collecting}
        title={disabled ? 'Select a watchlist to add stocks' : undefined}
        className={[
          'px-2.5 py-1 text-[10px] bg-slate-800/40 border rounded font-mono',
          'placeholder-slate-600 w-44 transition-colors',
          disabled || collecting
            ? 'border-slate-800/40 text-slate-600 cursor-not-allowed'
            : 'border-slate-700/40 text-slate-300 focus:border-blue-700/60 focus:outline-none',
        ].join(' ')}
      />
      {collecting && (
        <span className="text-[9px] text-blue-400 animate-pulse whitespace-nowrap">
          collecting {collecting.replace(/^[A-Z]+:/, '').replace(/-EQ$/, '')}…
        </span>
      )}

      {open && (
        <ul
          ref={listRef}
          className="absolute top-full mt-0.5 left-0 w-64 bg-[#0d1117] border border-[#1e2d3d]
                     rounded-lg shadow-2xl z-50 overflow-hidden"
        >
          {results.map((s, i) => (
            <li
              key={s.symbol}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setHighlighted(i)}
              className={[
                'px-3 py-1.5 text-[11px] cursor-pointer flex items-center justify-between gap-2',
                i === highlighted ? 'bg-slate-800/60' : 'hover:bg-slate-800/30',
              ].join(' ')}
            >
              <span className="text-slate-200 truncate">{s.name}</span>
              <span className="text-slate-500 shrink-0 text-[9px]">
                {s.symbol.replace(/^[A-Z]+:/, '').replace(/-EQ$/, '')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
