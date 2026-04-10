import { useState, useRef, useEffect } from 'react';

export default function WatchlistTabs({
  watchlists,
  activeId,
  activeSymbol,
  onSelectWatchlist,
  onSelectSymbol,
  onCreateWatchlist,
  onDeleteWatchlist,
  onRemoveSymbol,
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const inputRef = useRef(null);

  const activeWatchlist = watchlists.find(w => w.id === activeId) || null;

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await onCreateWatchlist(name);
      setNewName('');
      setCreating(false);
      setCreateError('');
    } catch (e) {
      setCreateError(e.message);
    }
  };

  const handleCreateKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    else if (e.key === 'Escape') { setCreating(false); setNewName(''); setCreateError(''); }
  };

  const userWatchlists = watchlists.filter(w => !w.is_default);
  const canCreate = userWatchlists.length < 5;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {/* Watchlist tabs row */}
      <div className="flex items-center gap-1 flex-wrap">
        {watchlists.map(wl => (
          <div key={wl.id} className="flex items-center gap-0.5 group">
            <button
              onClick={() => onSelectWatchlist(wl.id)}
              className={[
                'px-2.5 py-0.5 text-[10px] rounded font-mono transition-colors border',
                activeId === wl.id
                  ? 'bg-blue-900/50 border-blue-700/40 text-blue-300'
                  : 'bg-transparent border-slate-700/30 text-slate-500 hover:text-slate-300 hover:border-slate-600/40',
              ].join(' ')}
            >
              {wl.name}
              {wl.symbols.length > 0 && (
                <span className="ml-1 text-[8px] text-slate-600">{wl.symbols.length}</span>
              )}
            </button>
            {/* Delete button — only for user-created (non-default) watchlists */}
            {!wl.is_default && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteWatchlist(wl.id); }}
                title="Delete watchlist"
                className="text-[8px] text-slate-700 hover:text-red-400 px-0.5 hidden group-hover:inline transition-colors"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Create new watchlist */}
        {creating ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={newName}
              onChange={e => { setNewName(e.target.value); setCreateError(''); }}
              onKeyDown={handleCreateKeyDown}
              placeholder="Watchlist name…"
              maxLength={40}
              className="px-2 py-0.5 text-[10px] bg-slate-800/50 border border-blue-700/50
                         rounded font-mono text-slate-200 placeholder-slate-600 w-32 focus:outline-none"
            />
            <button
              onClick={handleCreate}
              className="text-[9px] text-blue-400 hover:text-blue-300 px-1"
            >ok</button>
            <button
              onClick={() => { setCreating(false); setNewName(''); setCreateError(''); }}
              className="text-[9px] text-slate-600 hover:text-slate-400 px-0.5"
            >✕</button>
            {createError && (
              <span className="text-[9px] text-red-400">{createError}</span>
            )}
          </div>
        ) : (
          canCreate && (
            <button
              onClick={() => setCreating(true)}
              title="New watchlist"
              className="px-2 py-0.5 text-[10px] rounded border border-dashed border-slate-700/40
                         text-slate-600 hover:text-slate-400 hover:border-slate-600/50 font-mono transition-colors"
            >
              + new
            </button>
          )
        )}
      </div>

      {/* Symbol chips for the active watchlist */}
      {activeWatchlist && activeWatchlist.symbols.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {activeWatchlist.symbols.map(sym => {
            const label = sym.replace(/^[A-Z]+:/, '').replace(/-EQ$/, '');
            const isActive = activeSymbol === sym;
            return (
              <div key={sym} className="flex items-center gap-0.5 group">
                <button
                  onClick={() => onSelectSymbol(sym)}
                  className={[
                    'px-2 py-0.5 text-[9px] rounded font-mono transition-colors border',
                    isActive
                      ? 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300'
                      : 'bg-transparent border-slate-700/20 text-slate-500 hover:text-slate-300 hover:border-slate-600/30',
                  ].join(' ')}
                >
                  {label}
                </button>
                {/* Remove from watchlist */}
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveSymbol(activeWatchlist.id, sym); }}
                  title="Remove from watchlist"
                  className="text-[7px] text-slate-700 hover:text-red-400 px-0.5 hidden group-hover:inline transition-colors"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeWatchlist && activeWatchlist.symbols.length === 0 && (
        <div className="text-[9px] text-slate-700 pl-0.5">
          Search and add stocks →
        </div>
      )}
    </div>
  );
}
