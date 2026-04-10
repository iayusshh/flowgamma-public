#!/usr/bin/env python3
"""
Public API surface for FlowGamma.

This file intentionally exposes only route contracts and request schemas wiring.
Signal computation and model logic are proprietary and excluded from this repository.
"""

from datetime import datetime

from fastapi import FastAPI, HTTPException

from schemas import (
    ActiveSymbolBody,
    AdminCooldownBody,
    AdminLoginBody,
    AdminRefreshNowBody,
    AdminToggleBody,
    WatchlistAddSymbol,
    WatchlistCreate,
)

app = FastAPI(
    title="FlowGamma Public API",
    description="Public route and schema mirror for FlowGamma",
    version="1.0.0",
)

FIXED_SYMBOLS = [
    "NSE:NIFTY50-INDEX",
    "NSE:NIFTYBANK-INDEX",
    "BSE:SENSEX-INDEX",
    "NSE:FINNIFTY-INDEX",
    "NSE:MIDCPNIFTY-INDEX",
    "BSE:BANKEX-INDEX",
]

WATCHLISTS = [
    {
        "id": 1,
        "name": "F&O Leaders",
        "is_default": True,
        "symbols": ["NSE:RELIANCE-EQ", "NSE:TCS-EQ"],
    }
]

PROPRIETARY_NOTE = (
    "Signal computation and strategy logic are proprietary and not included "
    "in this public repository."
)


def _proprietary_endpoint(name: str):
    raise HTTPException(
        status_code=501,
        detail={
            "endpoint": name,
            "status": "not_included",
            "note": PROPRIETARY_NOTE,
        },
    )


@app.get("/")
def root():
    return {
        "name": "FlowGamma Public API",
        "status": "ok",
        "mode": "public-mirror",
        "note": PROPRIETARY_NOTE,
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "flowgamma-public-api",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@app.get("/market-status")
def market_status():
    return {
        "is_open": None,
        "reason": "public_mirror",
        "note": "Live market-hours state is available in the private deployment.",
    }


@app.post("/admin/login")
def admin_login(body: AdminLoginBody):
    return {
        "status": "not_enabled",
        "username": body.username,
        "note": "Admin auth is disabled in this public mirror.",
    }


@app.post("/admin/logout")
def admin_logout():
    return {"status": "ok"}


@app.get("/admin/me")
def admin_me():
    return {"authenticated": False}


@app.get("/admin/status")
def admin_status():
    return {
        "system_stopped": False,
        "auto_mode_enabled": False,
        "note": "Control-plane internals are excluded in this public mirror.",
    }


@app.post("/admin/system/stop")
def admin_system_stop():
    return {"status": "disabled", "note": "Not available in public mirror."}


@app.post("/admin/system/start")
def admin_system_start():
    return {"status": "disabled", "note": "Not available in public mirror."}


@app.post("/admin/auto-mode")
def admin_auto_mode(body: AdminToggleBody):
    return {
        "status": "disabled",
        "requested_enabled": body.enabled,
        "note": "Not available in public mirror.",
    }


@app.post("/admin/manual-override")
def admin_manual_override(body: AdminToggleBody):
    return {
        "status": "disabled",
        "requested_enabled": body.enabled,
        "note": "Not available in public mirror.",
    }


@app.post("/admin/cooldown")
def admin_cooldown(body: AdminCooldownBody):
    return {
        "status": "disabled",
        "requested_seconds": body.seconds,
        "note": "Not available in public mirror.",
    }


@app.post("/admin/refresh-now")
def admin_refresh_now(body: AdminRefreshNowBody):
    return {
        "status": "accepted",
        "scope": body.scope,
        "symbol": body.symbol,
        "allow_closed_market": body.allow_closed_market,
        "note": "Public mirror accepts request shape; execution is disabled.",
    }


@app.get("/admin/actions")
def admin_actions():
    return {"count": 0, "actions": []}


@app.post("/gamma-tracker/refresh")
def gamma_tracker_refresh():
    return {
        "status": "accepted",
        "note": "Gamma tracker refresh pipeline is proprietary.",
    }


@app.get("/gamma-tracker/status")
def gamma_tracker_status():
    return {
        "symbols": {
            "NSE:NIFTY50-INDEX": {"status": "not_included"},
            "NSE:NIFTYBANK-INDEX": {"status": "not_included"},
            "BSE:SENSEX-INDEX": {"status": "not_included"},
        },
        "note": PROPRIETARY_NOTE,
    }


@app.post("/refresh/{symbol}")
def refresh_symbol(symbol: str):
    return {"status": "accepted", "symbol": symbol, "note": "Execution disabled."}


@app.post("/refresh-all-indices")
def refresh_all_indices():
    return {
        "status": "accepted",
        "symbols": FIXED_SYMBOLS,
        "note": "Execution disabled in this public mirror.",
    }


@app.post("/refresh-all-tracked")
def refresh_all_tracked():
    return {
        "status": "accepted",
        "note": "Tracked-universe refresh orchestration is proprietary.",
    }


@app.post("/active-symbol")
def set_active_symbol(body: ActiveSymbolBody):
    return {"status": "ok", "symbol": body.symbol}


@app.get("/signals/{symbol}")
def signals(symbol: str):
    _proprietary_endpoint(f"/signals/{symbol}")


@app.get("/signals/{symbol}/delta")
def signal_delta(symbol: str):
    _proprietary_endpoint(f"/signals/{symbol}/delta")


@app.get("/signals/{symbol}/oi-buildup")
def signal_oi_buildup(symbol: str):
    _proprietary_endpoint(f"/signals/{symbol}/oi-buildup")


@app.get("/signals/{symbol}/unusual")
def signal_unusual(symbol: str):
    _proprietary_endpoint(f"/signals/{symbol}/unusual")


@app.get("/signals/{symbol}/iv-skew")
def signal_iv_skew(symbol: str):
    _proprietary_endpoint(f"/signals/{symbol}/iv-skew")


@app.get("/signals/{symbol}/gex")
def signal_gex(symbol: str):
    _proprietary_endpoint(f"/signals/{symbol}/gex")


@app.get("/signals/{symbol}/conviction")
def signal_conviction(symbol: str):
    _proprietary_endpoint(f"/signals/{symbol}/conviction")


@app.get("/signals/{symbol}/gamma-tracker")
def signal_gamma_tracker(symbol: str):
    _proprietary_endpoint(f"/signals/{symbol}/gamma-tracker")


@app.get("/chain/{symbol}")
def chain(symbol: str):
    _proprietary_endpoint(f"/chain/{symbol}")


@app.get("/history/{symbol}")
def history(symbol: str):
    return {
        "symbol": symbol,
        "count": 0,
        "data": [],
        "note": "Historical analytics are omitted from public mirror.",
    }


@app.get("/history/{symbol}/conviction")
def history_conviction(symbol: str):
    return {"symbol": symbol, "count": 0, "data": []}


@app.get("/history/{symbol}/oi-buildup")
def history_oi_buildup(symbol: str):
    return {"symbol": symbol, "count": 0, "data": []}


@app.get("/history/{symbol}/unusual")
@app.get("/history/{symbol}/scan")
def history_scan(symbol: str):
    return {"symbol": symbol, "count": 0, "data": []}


@app.get("/history/{symbol}/iv-skew")
def history_iv_skew(symbol: str):
    return {"symbol": symbol, "count": 0, "data": []}


@app.get("/history/{symbol}/gex")
def history_gex(symbol: str):
    return {"symbol": symbol, "count": 0, "data": []}


@app.get("/health/scheduler")
def scheduler_health():
    return {
        "status": "not_enabled",
        "note": "Scheduler runtime is not included in this public mirror.",
    }


@app.get("/quote/{symbol}")
def quote(symbol: str):
    return {
        "symbol": symbol,
        "ltp": None,
        "source": "public_mirror",
        "note": "Live quote retrieval is disabled.",
    }


@app.get("/candles/{symbol}")
def candles(symbol: str, resolution: str = "15"):
    return {
        "symbol": symbol,
        "resolution": resolution,
        "count": 0,
        "candles": [],
        "note": "Historical candle retrieval is disabled in public mirror.",
    }


@app.get("/technicals/{symbol}")
def technicals(symbol: str):
    return {
        "symbol": symbol,
        "timeframes": {},
        "note": "Technical computation logic is proprietary.",
    }


@app.get("/symbols")
def symbols():
    return {
        "fixed_indices": FIXED_SYMBOLS,
        "stocks": [],
    }


@app.get("/watchlists")
def watchlists():
    return {"watchlists": WATCHLISTS}


@app.post("/watchlists", status_code=201)
def create_watchlist(body: WatchlistCreate):
    created = {
        "id": len(WATCHLISTS) + 1,
        "name": body.name,
        "is_default": False,
        "symbols": [],
    }
    WATCHLISTS.append(created)
    return created


@app.get("/watchlists/summary")
def watchlists_summary():
    return {
        "summary": {},
        "fetched_at": datetime.utcnow().isoformat() + "Z",
    }


@app.delete("/watchlists/{watchlist_id}")
def delete_watchlist(watchlist_id: int):
    for idx, item in enumerate(WATCHLISTS):
        if item["id"] == watchlist_id:
            WATCHLISTS.pop(idx)
            return {"status": "deleted", "id": watchlist_id}
    raise HTTPException(status_code=404, detail="Watchlist not found")


@app.post("/watchlists/{watchlist_id}/symbols", status_code=201)
def add_symbol_to_watchlist(watchlist_id: int, body: WatchlistAddSymbol):
    for item in WATCHLISTS:
        if item["id"] == watchlist_id:
            if body.symbol not in item["symbols"]:
                item["symbols"].append(body.symbol)
            return {"status": "ok", "watchlist_id": watchlist_id, "symbol": body.symbol}
    raise HTTPException(status_code=404, detail="Watchlist not found")


@app.delete("/watchlists/{watchlist_id}/symbols/{symbol}")
def remove_symbol_from_watchlist(watchlist_id: int, symbol: str):
    for item in WATCHLISTS:
        if item["id"] == watchlist_id:
            item["symbols"] = [s for s in item["symbols"] if s != symbol]
            return {"status": "ok", "watchlist_id": watchlist_id, "symbol": symbol}
    raise HTTPException(status_code=404, detail="Watchlist not found")


@app.get("/stream/{symbol}")
def stream(symbol: str):
    return {
        "symbol": symbol,
        "status": "not_enabled",
        "note": "SSE stream transport is disabled in public mirror.",
    }


@app.post("/internal/snapshot-ready/{symbol}")
def snapshot_ready(symbol: str):
    return {
        "status": "accepted",
        "symbol": symbol,
        "note": "Internal cache invalidation hooks are not active in public mirror.",
    }


@app.get("/fyers-token")
def fyers_token():
    raise HTTPException(status_code=403, detail="Not exposed in public mirror")
