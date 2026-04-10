import { useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/$/, '');

async function safeFetch(url, options) {
  try {
    const r = await fetch(url, options);
    if (r.ok) return r.json();
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    const detail = err.detail || r.statusText || 'Request failed';
    throw new Error(`${detail} (${r.status} ${r.statusText})`);
  } catch (e) {
    throw e;
  }
}

export function useWatchlists() {
  const [watchlists, setWatchlists] = useState([]);
  const [fnoStocks, setFnoStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadWatchlists = useCallback(async () => {
    try {
      const data = await safeFetch(`${API_BASE}/watchlists`);
      setWatchlists(data.watchlists || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadSymbols = useCallback(async () => {
    try {
      const data = await safeFetch(`${API_BASE}/symbols`);
      setFnoStocks(data.fno_stocks || []);
    } catch (e) {
      // non-fatal: search just won't work until backend responds
    }
  }, []);

  useEffect(() => {
    Promise.all([loadWatchlists(), loadSymbols()]).finally(() => setLoading(false));
  }, [loadWatchlists, loadSymbols]);

  const createWatchlist = useCallback(async (name) => {
    const wl = await safeFetch(`${API_BASE}/watchlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    await loadWatchlists();
    return wl;
  }, [loadWatchlists]);

  const deleteWatchlist = useCallback(async (id) => {
    await safeFetch(`${API_BASE}/watchlists/${id}`, { method: 'DELETE' });
    await loadWatchlists();
  }, [loadWatchlists]);

  const addSymbol = useCallback(async (watchlistId, symbol) => {
    await safeFetch(`${API_BASE}/watchlists/${watchlistId}/symbols`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    });
    await loadWatchlists();
  }, [loadWatchlists]);

  const removeSymbol = useCallback(async (watchlistId, symbol) => {
    const enc = encodeURIComponent(symbol);
    await safeFetch(`${API_BASE}/watchlists/${watchlistId}/symbols/${enc}`, {
      method: 'DELETE',
    });
    await loadWatchlists();
  }, [loadWatchlists]);

  return {
    watchlists,
    fnoStocks,
    loading,
    error,
    createWatchlist,
    deleteWatchlist,
    addSymbol,
    removeSymbol,
    reload: loadWatchlists,
  };
}
