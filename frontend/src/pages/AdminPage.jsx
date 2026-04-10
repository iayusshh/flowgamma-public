import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'flowgammaAdminToken';

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function setToken(token) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const detail = (data && data.detail) || response.statusText || 'Request failed';
    throw new Error(detail);
  }
  return data;
}

function StatCard({ title, value, hint, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-700/70 bg-slate-900/60 text-slate-200',
    green: 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200',
    red: 'border-rose-700/60 bg-rose-950/45 text-rose-200',
    amber: 'border-amber-700/60 bg-amber-950/45 text-amber-200',
    blue: 'border-cyan-700/60 bg-cyan-950/45 text-cyan-200',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone] || tones.slate}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] opacity-80">{title}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-[11px] opacity-80">{hint}</div> : null}
    </div>
  );
}

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState(null);
  const [actions, setActions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cooldown, setCooldown] = useState(30);
  const [refreshScope, setRefreshScope] = useState('tracked');
  const [refreshSymbol, setRefreshSymbol] = useState('');
  const [forceOffHours, setForceOffHours] = useState(false);

  const loadStatus = useCallback(async () => {
    const [s, a] = await Promise.all([
      apiRequest('/admin/status'),
      apiRequest('/admin/actions?limit=120'),
    ]);
    setStatus(s);
    setActions(a.actions || []);
    setCooldown(Number(s?.runtime?.refresh_cooldown_sec || 30));
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const session = await apiRequest('/admin/me');
      setMe(session);
      await loadStatus();
    } catch {
      setToken('');
      setMe(null);
    } finally {
      setAuthChecked(true);
    }
  }, [loadStatus]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!me) return;
    const id = setInterval(() => {
      loadStatus().catch(() => null);
    }, 5000);
    return () => clearInterval(id);
  }, [me, loadStatus]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice('');
    setBusy(true);
    try {
      const loginRes = await apiRequest('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(loginRes.token || '');
      setPassword('');
      setNotice('Logged in. Admin controls are active.');
      await checkSession();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await apiRequest('/admin/logout', { method: 'POST' });
      setToken('');
      setMe(null);
      setStatus(null);
      setActions([]);
      setNotice('Logged out.');
    } catch (err) {
      setError(err.message || 'Logout failed');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (label, path, body) => {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const res = await apiRequest(path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setNotice(`${label}: ${res.status || 'ok'}`);
      await loadStatus();
    } catch (err) {
      setError(`${label}: ${err.message || 'failed'}`);
    } finally {
      setBusy(false);
    }
  };

  const systemStopped = !!status?.runtime?.system_stopped;
  const autoModeEnabled = !!status?.runtime?.auto_mode_enabled;
  const manualOverrideEnabled = !!status?.runtime?.allow_manual_refresh_when_stopped;
  const marketOpen = !!status?.market?.is_open;

  const actionRows = useMemo(() => {
    return [...actions].reverse();
  }, [actions]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0b1117] text-slate-200 font-mono flex items-center justify-center">
        <div className="text-sm text-slate-400">Checking admin session...</div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#11213a_0%,#090f17_45%,#070b12_100%)] text-slate-100 font-mono px-4 py-8">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-700/70 bg-slate-950/70 p-6 shadow-[0_20px_90px_rgba(2,8,23,0.6)]">
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">FlowGamma Control</div>
          <h1 className="mt-2 text-2xl font-semibold">Admin Access</h1>
          <p className="mt-2 text-xs text-slate-400">
            Restricted controls for system stop/start, refresh governance, and emergency operations.
          </p>

          <form onSubmit={handleLogin} className="mt-5 space-y-3">
            <div>
              <label className="text-[11px] text-slate-400">Username</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Password</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg border border-cyan-600/60 bg-cyan-900/35 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-60"
            >
              {busy ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {error ? <div className="mt-3 rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">{error}</div> : null}
          {notice ? <div className="mt-3 rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">{notice}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#071018_0%,#0b1420_40%,#0c1218_100%)] text-slate-100 font-mono">
      <div className="mx-auto max-w-7xl px-4 py-4 md:py-6 space-y-4">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/65 p-4 md:p-5 shadow-[0_20px_90px_rgba(2,8,23,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">FlowGamma Admin</div>
              <h1 className="text-2xl md:text-3xl font-semibold">System Control Panel</h1>
              <div className="mt-1 text-xs text-slate-400">Signed in as {me.username}</div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/"
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300"
              >
                Open Dashboard
              </a>
              <button
                onClick={handleLogout}
                disabled={busy}
                className="rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              title="Market"
              value={marketOpen ? 'OPEN' : 'CLOSED'}
              hint={status?.market?.reason || 'Unknown'}
              tone={marketOpen ? 'green' : 'amber'}
            />
            <StatCard
              title="System"
              value={systemStopped ? 'FORCE STOPPED' : 'RUNNING'}
              hint={systemStopped ? 'All refresh blocked by admin' : 'Refresh paths enabled'}
              tone={systemStopped ? 'red' : 'green'}
            />
            <StatCard
              title="Auto Mode"
              value={autoModeEnabled ? 'ENABLED' : 'DISABLED'}
              hint={autoModeEnabled ? 'Scheduled loops may run' : 'Automated loops are paused'}
              tone={autoModeEnabled ? 'blue' : 'amber'}
            />
            <StatCard
              title="Scheduler"
              value={status?.runtime?.scheduler_running ? 'ACTIVE' : 'INACTIVE'}
              hint={status?.runtime?.scheduler_pid ? `PID ${status.runtime.scheduler_pid}` : 'No PID'}
              tone={status?.runtime?.scheduler_running ? 'green' : 'slate'}
            />
          </div>

          {error ? <div className="mt-3 rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">{error}</div> : null}
          {notice ? <div className="mt-3 rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">{notice}</div> : null}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.35fr] gap-4">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/65 p-4 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Emergency Controls</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => runAction('Force Stop', '/admin/system/stop')}
                  disabled={busy || confirmText !== 'STOP'}
                  className="rounded-lg border border-rose-700/70 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50"
                >
                  Force Stop System
                </button>
                <button
                  onClick={() => runAction('Resume System', '/admin/system/start')}
                  disabled={busy}
                  className="rounded-lg border border-emerald-700/70 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-60"
                >
                  Resume System
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">Type STOP to enable force stop.</div>
              <input
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-xs outline-none focus:border-rose-500"
                placeholder="Type STOP"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Mode Toggles</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  onClick={() => runAction('Auto Mode', '/admin/auto-mode', { enabled: !autoModeEnabled })}
                  disabled={busy}
                  className="rounded-lg border border-cyan-700/70 bg-cyan-950/35 px-3 py-2 text-xs text-cyan-200 disabled:opacity-60"
                >
                  Auto Mode: {autoModeEnabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => runAction('Manual Override', '/admin/manual-override', { enabled: !manualOverrideEnabled })}
                  disabled={busy}
                  className="rounded-lg border border-amber-700/70 bg-amber-950/35 px-3 py-2 text-xs text-amber-200 disabled:opacity-60"
                >
                  Manual Override: {manualOverrideEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Cooldown Control</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={3600}
                  value={cooldown}
                  onChange={(e) => setCooldown(Number(e.target.value || 0))}
                  className="w-28 rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-xs outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => runAction('Cooldown', '/admin/cooldown', { seconds: Number(cooldown || 0) })}
                  disabled={busy}
                  className="rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
                >
                  Save Cooldown
                </button>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Seconds between manual refresh triggers.</div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Manual Refresh</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                <select
                  value={refreshScope}
                  onChange={(e) => setRefreshScope(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-xs outline-none focus:border-cyan-500"
                >
                  <option value="tracked">Tracked</option>
                  <option value="indices">Indices</option>
                  <option value="symbol">Single Symbol</option>
                </select>
                <input
                  value={refreshSymbol}
                  onChange={(e) => setRefreshSymbol(e.target.value.toUpperCase())}
                  disabled={refreshScope !== 'symbol'}
                  placeholder="NSE:RELIANCE-EQ"
                  className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-xs outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                <button
                  onClick={() => runAction('Refresh Now', '/admin/refresh-now', {
                    scope: refreshScope,
                    symbol: refreshScope === 'symbol' ? refreshSymbol : null,
                    force_off_hours: forceOffHours,
                  })}
                  disabled={busy || (refreshScope === 'symbol' && !refreshSymbol)}
                  className="rounded-lg border border-fuchsia-700/70 bg-fuchsia-950/35 px-3 py-2 text-xs text-fuchsia-200 disabled:opacity-60"
                >
                  Queue Refresh
                </button>
              </div>
              <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  checked={forceOffHours}
                  onChange={(e) => setForceOffHours(e.target.checked)}
                />
                Allow off-hours refresh
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/65 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Action Log</div>
                <div className="text-xs text-slate-500 mt-1">Latest admin and guard events</div>
              </div>
              <button
                onClick={() => loadStatus().catch(() => null)}
                className="rounded-md border border-slate-700 bg-slate-900/75 px-2 py-1 text-[11px] text-slate-300"
              >
                Refresh
              </button>
            </div>

            <div className="mt-3 max-h-[540px] overflow-auto rounded-lg border border-slate-800">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-900/90 text-slate-400">
                  <tr>
                    <th className="px-2 py-2 text-left">Time</th>
                    <th className="px-2 py-2 text-left">Action</th>
                    <th className="px-2 py-2 text-left">Actor</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {actionRows.length ? actionRows.map((row, idx) => (
                    <tr key={`${row.ts}-${idx}`} className="border-t border-slate-800/80">
                      <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{row.ts || '-'}</td>
                      <td className="px-2 py-1.5 text-slate-200 whitespace-nowrap">{row.action || '-'}</td>
                      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">{row.actor || '-'}</td>
                      <td className={`px-2 py-1.5 whitespace-nowrap ${row.status === 'blocked' || row.status === 'denied' ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {row.status || '-'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-400">{row.detail || '-'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No actions logged yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
