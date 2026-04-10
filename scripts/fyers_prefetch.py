#!/usr/bin/env python3
"""
FYERS Prefetch Script
Fetches live market data from FYERS and saves JSON files to the shared workspace folder.
Claude's analysis and OI skills read these files automatically.

Usage:
  # Fetch price data (for /analysis and /post)
  python /Users/iayusshh/claude/fyers_prefetch.py NSE:NIFTY50-INDEX
  python /Users/iayusshh/claude/fyers_prefetch.py NSE:RELIANCE-EQ

  # Fetch option chain data (for /oi)
  python /Users/iayusshh/claude/fyers_prefetch.py NSE:NIFTY50-INDEX --oi
  python /Users/iayusshh/claude/fyers_prefetch.py NSE:NIFTYBANK-INDEX --oi

  # Fetch both price + option chain in one go
  python /Users/iayusshh/claude/fyers_prefetch.py NSE:NIFTY50-INDEX --all

Data is saved to /Users/iayusshh/claude/fyers_data/<symbol>/
"""

import sys
import json
import os
from datetime import datetime, timedelta

CONFIG_PATH = os.environ.get("FYERS_CONFIG_PATH", "/Users/iayusshh/claude/fyers_config.json")
DATA_DIR = os.environ.get("FYERS_DATA_DIR", "/Users/iayusshh/claude/fyers_data")


def load_config():
    """Load FYERS config from file, or construct from environment variables."""
    # Prefer env vars (works on Railway/cloud where config file doesn't exist)
    if os.environ.get("FYERS_APP_ID") and os.environ.get("FYERS_ACCESS_TOKEN"):
        return {
            "app_id": os.environ["FYERS_APP_ID"],
            "secret_key": os.environ.get("FYERS_SECRET_KEY", ""),
            "redirect_uri": os.environ.get("FYERS_REDIRECT_URI", ""),
            "access_token": os.environ["FYERS_ACCESS_TOKEN"],
        }
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def get_client(config):
    from fyers_apiv3 import fyersModel

    # Access token may come directly from config (env var path) or from token file
    access_token = config.get("access_token")
    if not access_token:
        token_path = config.get("token_path", "/Users/iayusshh/claude/fyers_token.json")
        if not os.path.exists(token_path):
            print("ERROR: No token found. Run: python fyers_helper.py auth && python fyers_helper.py token <code>")
            sys.exit(1)
        with open(token_path, "r") as f:
            token_data = json.load(f)
        access_token = token_data.get("access_token")

    if not access_token:
        print("ERROR: Token empty. Re-authenticate with fyers_helper.py")
        sys.exit(1)

    client = fyersModel.FyersModel(
        client_id=config["app_id"],
        is_async=False,
        token=access_token,
        log_path=""
    )
    return client


def safe_symbol_dir(symbol):
    """Convert NSE:RELIANCE-EQ to NSE_RELIANCE_EQ for folder name."""
    return symbol.replace(":", "_").replace("-", "_")


def fetch_price_data(client, symbol, symbol_dir):
    """Fetch quote + monthly/weekly/daily/hourly candles."""

    # 1. Live quote
    print("  [1/6] Live quote...")
    resp = client.quotes({"symbols": symbol})
    if resp.get("code") == 200 or resp.get("s") == "ok":
        quotes = []
        for item in resp.get("d", []):
            v = item.get("v", {})
            quotes.append({
                "symbol": item.get("n", ""),
                "ltp": v.get("lp", 0),
                "open": v.get("open_price", 0),
                "high": v.get("high_price", 0),
                "low": v.get("low_price", 0),
                "prev_close": v.get("prev_close_price", 0),
                "change": v.get("ch", 0),
                "change_pct": v.get("chp", 0),
                "volume": v.get("volume", 0),
                "timestamp": v.get("tt", 0),
            })
        with open(os.path.join(symbol_dir, "quote.json"), "w") as f:
            json.dump({"status": "ok", "quotes": quotes}, f, indent=2)
        print(f"     LTP = {quotes[0]['ltp'] if quotes else 'N/A'}")
    else:
        print(f"  WARNING: Quote failed: {resp}")

    # Helper to fetch raw candles from FYERS for a specific date range
    # FYERS limits 1D resolution to 366 days per request -- use fetch_raw_candles_chunked for longer ranges
    def fetch_raw_candles_range(resolution, start_date, end_date):
        data = {
            "symbol": symbol,
            "resolution": resolution,
            "date_format": "1",
            "range_from": start_date.strftime("%Y-%m-%d"),
            "range_to": end_date.strftime("%Y-%m-%d"),
            "cont_flag": "1",
        }
        resp = client.history(data)
        if resp.get("code") == 200 or resp.get("s") == "ok":
            candles = []
            for c in resp.get("candles", []):
                candles.append({
                    "timestamp": c[0],
                    "date": datetime.fromtimestamp(c[0]).strftime("%Y-%m-%d %H:%M"),
                    "open": c[1],
                    "high": c[2],
                    "low": c[3],
                    "close": c[4],
                    "volume": c[5],
                })
            return candles
        else:
            print(f"  WARNING: Fetch failed ({resolution}, {start_date.date()} to {end_date.date()}): {resp}")
            return None

    def fetch_raw_candles(resolution, days, chunk_size=365):
        """Fetch candles over a long range by splitting into chunks of chunk_size days.
        FYERS caps 1D resolution at 366 days per request."""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        all_candles = []
        seen_timestamps = set()

        chunk_end = end_date
        while chunk_end > start_date:
            chunk_start = max(chunk_end - timedelta(days=chunk_size), start_date)
            chunk = fetch_raw_candles_range(resolution, chunk_start, chunk_end)
            if chunk is None:
                return None
            for c in chunk:
                if c["timestamp"] not in seen_timestamps:
                    seen_timestamps.add(c["timestamp"])
                    all_candles.append(c)
            chunk_end = chunk_start - timedelta(days=1)

        all_candles.sort(key=lambda c: c["timestamp"])
        return all_candles

    def save_candles(candles, filename, resolution_label):
        if candles is None:
            return False
        path = os.path.join(symbol_dir, filename)
        with open(path, "w") as f:
            json.dump({
                "status": "ok",
                "symbol": symbol,
                "resolution": resolution_label,
                "count": len(candles),
                "candles": candles
            }, f, indent=2)
        print(f"     {resolution_label}: {len(candles)} candles")
        return True

    def resample_to_weekly(daily_candles):
        """Group daily candles into ISO weeks. OHLC: open=Mon open, high=week max, low=week min, close=Fri close."""
        from collections import defaultdict
        weeks = defaultdict(list)
        for c in daily_candles:
            dt = datetime.fromtimestamp(c["timestamp"])
            # ISO week key: year-weeknumber
            week_key = dt.strftime("%Y-%W")
            weeks[week_key].append(c)
        result = []
        for key in sorted(weeks.keys()):
            group = weeks[key]
            result.append({
                "timestamp": group[0]["timestamp"],
                "date": group[0]["date"][:10],
                "open": group[0]["open"],
                "high": max(c["high"] for c in group),
                "low": min(c["low"] for c in group),
                "close": group[-1]["close"],
                "volume": sum(c["volume"] for c in group),
            })
        return result

    def resample_to_monthly(daily_candles):
        """Group daily candles into calendar months."""
        from collections import defaultdict
        months = defaultdict(list)
        for c in daily_candles:
            dt = datetime.fromtimestamp(c["timestamp"])
            month_key = dt.strftime("%Y-%m")
            months[month_key].append(c)
        result = []
        for key in sorted(months.keys()):
            group = months[key]
            result.append({
                "timestamp": group[0]["timestamp"],
                "date": group[0]["date"][:7],
                "open": group[0]["open"],
                "high": max(c["high"] for c in group),
                "low": min(c["low"] for c in group),
                "close": group[-1]["close"],
                "volume": sum(c["volume"] for c in group),
            })
        return result

    # 2. Monthly candles -- fetch 2 years of daily, resample to monthly
    print("  [2/6] Monthly candles (resampled from daily)...")
    daily_2yr = fetch_raw_candles("1D", 730)
    if daily_2yr:
        monthly = resample_to_monthly(daily_2yr)
        save_candles(monthly, "candles_m.json", "Monthly")

    # 3. Weekly candles -- fetch 1 year of daily, resample to weekly
    print("  [3/6] Weekly candles (resampled from daily)...")
    daily_1yr = fetch_raw_candles("1D", 365)
    if daily_1yr:
        weekly = resample_to_weekly(daily_1yr)
        save_candles(weekly, "candles_w.json", "Weekly")

    # 4. Daily candles (60 days)
    print("  [4/8] Daily candles...")
    daily_60 = fetch_raw_candles("1D", 60)
    save_candles(daily_60, "candles_d.json", "Daily")

    # 5. Hourly candles (last 20 days)
    print("  [5/8] Hourly candles...")
    hourly = fetch_raw_candles("60", 20)
    save_candles(hourly, "candles_60.json", "Hourly")

    # 6. 15-minute candles (last 30 days)
    print("  [6/8] 15-minute candles...")
    candles_15m = fetch_raw_candles("15", 30)
    save_candles(candles_15m, "candles_15.json", "15min")

    # 7. 5-minute candles (last 20 days)
    print("  [7/9] 5-minute candles...")
    candles_5m = fetch_raw_candles("5", 20)
    save_candles(candles_5m, "candles_5.json", "5min")

    # 8. 3-minute candles (last 15 days)
    print("  [8/9] 3-minute candles...")
    candles_3m = fetch_raw_candles("3", 15)
    save_candles(candles_3m, "candles_3.json", "3min")

    # 9. 1-minute candles (last 5 days — FYERS restricts 1m data to ~5 days)
    print("  [9/9] 1-minute candles...")
    candles_1m = fetch_raw_candles("1", 5)
    save_candles(candles_1m, "candles_1.json", "1min")


def is_stock_symbol(symbol):
    """Return True for NSE F&O equity symbols (ends with -EQ)."""
    return symbol.upper().endswith("-EQ")


def select_monthly_expiry(expiry_data):
    """Pick the nearest monthly expiry for stock F&O options.

    Stock options on NSE expire on the last TUESDAY of the month
    (distinct from NIFTY/BANKNIFTY which expire on Thursday).

    FYERS expiryData is a list of dicts: [{"expiry": <unix_ts>, ...}, ...]
    sorted nearest-first.  Returns the matching dict or the last entry as fallback.
    """
    from datetime import date, timedelta

    def last_tuesday(d):
        if d.month == 12:
            last_day = date(d.year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(d.year, d.month + 1, 1) - timedelta(days=1)
        # weekday(): Monday=0 … Tuesday=1
        return last_day - timedelta(days=(last_day.weekday() - 1) % 7)

    for entry in expiry_data:
        exp_date = date.fromtimestamp(int(entry["expiry"]))
        if exp_date == last_tuesday(exp_date):
            return entry
    # Fallback: take the farthest available expiry (most likely monthly)
    return expiry_data[-1] if expiry_data else None


def liquidity_filter_strikes(strikes_map, spot, above=8, below=8):
    """Keep the `above` strikes above spot and `below` strikes below spot
    with the highest combined CE+PE volume, discarding illiquid far-OTM contracts.
    Returns a filtered strikes_map dict.
    """
    sorted_sp = sorted(strikes_map.keys())
    above_atm = [s for s in sorted_sp if s > spot]
    below_atm = [s for s in sorted_sp if s <= spot]

    def combined_vol(s):
        entry = strikes_map[s]
        ce_vol = (entry.get("CE") or {}).get("volume", 0) or 0
        pe_vol = (entry.get("PE") or {}).get("volume", 0) or 0
        return ce_vol + pe_vol

    top_above = sorted(sorted(above_atm, key=combined_vol, reverse=True)[:above])
    top_below = sorted(sorted(below_atm, key=combined_vol, reverse=True)[:below])
    selected = set(top_above + top_below)
    return {s: strikes_map[s] for s in sorted_sp if s in selected}


def fetch_option_chain(client, symbol, symbol_dir):
    """Fetch option chain and save to option_chain.json.

    For equity (stock) symbols: uses the nearest *monthly* expiry and applies
    a liquidity filter (8 above + 8 below ATM by volume).
    For index symbols: uses current/nearest expiry with a fixed 15-strike window.
    """
    is_stock = is_stock_symbol(symbol)

    # Determine expiry timestamp to use
    expiry_ts = ""
    if is_stock:
        print("  Probing expiry dates for monthly expiry selection...")
        probe_resp = client.optionchain(data={"symbol": symbol, "strikecount": 1, "timestamp": ""})
        if probe_resp.get("s") == "ok" or probe_resp.get("code") == 200:
            probe_expiry_data = probe_resp.get("data", {}).get("expiryData", [])
            monthly = select_monthly_expiry(probe_expiry_data)
            if monthly:
                expiry_ts = str(int(monthly["expiry"]))
                from datetime import date
                exp_date = date.fromtimestamp(int(monthly["expiry"]))
                print(f"  Selected monthly expiry: {exp_date}")
            else:
                print("  WARNING: Could not detect monthly expiry, using nearest")
        else:
            print(f"  WARNING: Expiry probe failed: {probe_resp}")

    strikecount = 20 if is_stock else 15  # 20 for stocks (will be filtered to 8+8)

    if is_stock:
        print(f"  Fetching option chain (monthly expiry, {strikecount} strikes)...")
    else:
        print("  Fetching option chain (current expiry)...")

    data = {
        "symbol": symbol,
        "strikecount": strikecount,
        "timestamp": expiry_ts,
    }

    resp = client.optionchain(data=data)

    if not (resp.get("s") == "ok" or resp.get("code") == 200):
        print(f"  ERROR: Option chain fetch failed: {resp}")
        print("  Note: Option chain is only available for F&O instruments.")
        return False

    raw = resp["data"]

    # FYERS returns a flat list in raw["optionsChain"]
    # Each item includes price + OI fields, e.g.:
    # {option_type, strike_price, symbol, ltp, bid, ask, volume, oi, oich, oichp, prev_oi, ...}
    flat_chain = raw.get("optionsChain", [])
    expiry_data = raw.get("expiryData", [])
    total_call_oi = raw.get("callOi", 0)
    total_put_oi = raw.get("putOi", 0)

    # India VIX
    vix_data = raw.get("indiavixData", {})
    india_vix = vix_data.get("ltp", None)

    print(f"  Found {len(flat_chain)} option contracts across all strikes")
    print(f"  Total Call OI: {total_call_oi:,}  |  Total Put OI: {total_put_oi:,}")
    if india_vix:
        print(f"  India VIX: {india_vix}")

    # Group into a dict: strike -> {CE: {...}, PE: {...}}
    strikes_map = {}
    all_symbols = []
    for item in flat_chain:
        sp = item.get("strike_price", 0)
        if sp <= 0:
            continue  # filter ghost/invalid strikes
        otype = item.get("option_type", "").upper()
        sym = item.get("symbol", "")
        if sp not in strikes_map:
            strikes_map[sp] = {"CE": None, "PE": None}
        strikes_map[sp][otype] = {
            "symbol": sym,
            "ltp": item.get("ltp", 0),
            "ltp_change": item.get("ltpch", 0),
            "ltp_change_pct": item.get("ltpchp", 0),
            "bid": item.get("bid", 0),
            "ask": item.get("ask", 0),
            "volume": item.get("volume", 0) or 0,
            "oi": item.get("oi", 0) or 0,
            "oi_change": item.get("oich", 0) or 0,
            "oi_change_pct": item.get("oichp", 0) or 0,
            "prev_oi": item.get("prev_oi", 0) or 0,
            "iv": 0,
            "delta": 0,
            "gamma": 0,
            "theta": 0,
            "vega": 0,
        }
        if sym:
            all_symbols.append(sym)

    # Fallback volume fetch via quotes() for symbols where optionchain volume is missing.
    print(f"  Backfilling missing volume for {len(all_symbols)} symbols (batched)...")
    quotes_map = {}
    batch_size = 50
    for i in range(0, len(all_symbols), batch_size):
        batch = all_symbols[i:i + batch_size]
        q_resp = client.quotes({"symbols": ",".join(batch)})
        if q_resp.get("s") == "ok" or q_resp.get("code") == 200:
            for entry in q_resp.get("d", []):
                sym_name = entry.get("n", "")
                v = entry.get("v", {})
                quotes_map[sym_name] = {"volume": v.get("volume", 0)}
        else:
            print(f"  WARNING: quotes batch {i//batch_size + 1} failed: {q_resp.get('message', q_resp)}")

    # Merge fallback volume back into strikes_map only when optionchain volume is absent.
    for sp, sides in strikes_map.items():
        for otype in ("CE", "PE"):
            side = sides.get(otype)
            if side and not side.get("volume") and side.get("symbol") in quotes_map:
                side["volume"] = quotes_map[side["symbol"]]["volume"]

    # For stock symbols: filter to 8 above + 8 below ATM by volume (liquidity filter)
    # Get spot first (needed for the filter) from quote.json if available
    _spot_for_filter = None
    _quote_path_tmp = os.path.join(symbol_dir, "quote.json")
    if os.path.exists(_quote_path_tmp):
        with open(_quote_path_tmp) as _f:
            _q = json.load(_f)
            _ql = _q.get("quotes", [])
            if _ql:
                _spot_for_filter = _ql[0].get("ltp")
    if _spot_for_filter is None and strikes_map:
        _sp_list = sorted(strikes_map.keys())
        _spot_for_filter = _sp_list[len(_sp_list) // 2]

    if is_stock and _spot_for_filter:
        before_count = len(strikes_map)
        strikes_map = liquidity_filter_strikes(strikes_map, _spot_for_filter, above=8, below=8)
        print(f"  Liquidity filter: {before_count} → {len(strikes_map)} strikes (8 above + 8 below ATM)")

    # --- Compute IV and Greeks using Black-Scholes ---
    # FYERS does not provide IV or greeks via API. Compute from option prices.
    import math

    RISK_FREE_RATE = 0.065  # 6.5% -- current India repo rate approximation

    def norm_cdf(x):
        """Standard normal CDF using Horner's method approximation."""
        a = abs(x)
        t = 1.0 / (1.0 + 0.2316419 * a)
        d = 0.3989422820 * math.exp(-a * a / 2)
        p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302745))))
        return 1.0 - p if x > 0 else p

    def norm_pdf(x):
        return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)

    def bs_price(S, K, T, r, sigma, option_type):
        if T <= 0 or sigma <= 0:
            intrinsic = max(S - K, 0) if option_type == "CE" else max(K - S, 0)
            return intrinsic
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        if option_type == "CE":
            return S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2)
        else:
            return K * math.exp(-r * T) * norm_cdf(-d2) - S * norm_cdf(-d1)

    def calc_iv(S, K, T, r, market_price, option_type, tol=1e-6, max_iter=100):
        """Bisection method to solve for implied volatility."""
        if market_price <= 0 or T <= 0:
            return 0.0
        intrinsic = max(S - K, 0) if option_type == "CE" else max(K - S, 0)
        if market_price <= intrinsic:
            return 0.0
        lo, hi = 0.001, 5.0  # sigma bounds: 0.1% to 500%
        for _ in range(max_iter):
            mid = (lo + hi) / 2
            price = bs_price(S, K, T, r, mid, option_type)
            if abs(price - market_price) < tol:
                return mid
            if price < market_price:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2

    def calc_greeks(S, K, T, r, sigma, option_type):
        if T <= 0 or sigma <= 0:
            return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0}
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        nd1 = norm_pdf(d1)
        gamma = nd1 / (S * sigma * math.sqrt(T))
        vega = S * nd1 * math.sqrt(T) / 100  # per 1% change in vol
        if option_type == "CE":
            delta = norm_cdf(d1)
            theta = (-S * nd1 * sigma / (2 * math.sqrt(T)) - r * K * math.exp(-r * T) * norm_cdf(d2)) / 365
        else:
            delta = norm_cdf(d1) - 1
            theta = (-S * nd1 * sigma / (2 * math.sqrt(T)) + r * K * math.exp(-r * T) * norm_cdf(-d2)) / 365
        return {
            "delta": round(delta, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta, 2),
            "vega": round(vega, 2),
        }

    # Get spot price from quote.json if available, else estimate from chain
    spot = None
    quote_path = os.path.join(symbol_dir, "quote.json")
    if os.path.exists(quote_path):
        with open(quote_path) as f:
            q_data = json.load(f)
            quotes_list = q_data.get("quotes", [])
            if quotes_list:
                spot = quotes_list[0].get("ltp")
    if not spot:
        # Fallback: find strike closest to mid of chain
        strikes_list = sorted(strikes_map.keys())
        spot = strikes_list[len(strikes_list) // 2] if strikes_list else None

    # Expiry timestamp for Black-Scholes T calculation
    # For stocks: use the selected monthly expiry; for indices: use nearest
    nearest_expiry_ts = None
    if is_stock and expiry_ts:
        nearest_expiry_ts = int(expiry_ts)
    elif expiry_data:
        nearest_expiry_ts = int(expiry_data[0]["expiry"])

    print(f"  Computing IV and greeks (BS model, spot={spot}, risk-free={RISK_FREE_RATE*100}%)...")
    iv_computed = 0
    for sp, sides in strikes_map.items():
        if sp <= 0 or spot is None:
            continue
        if nearest_expiry_ts:
            T = max((nearest_expiry_ts - datetime.now().timestamp()) / (365.25 * 24 * 3600), 0)
        else:
            T = 0
        for otype in ("CE", "PE"):
            side = sides.get(otype)
            if not side or side.get("ltp", 0) <= 0:
                continue
            ltp = side["ltp"]
            iv = calc_iv(spot, sp, T, RISK_FREE_RATE, ltp, otype)
            greeks = calc_greeks(spot, sp, T, RISK_FREE_RATE, iv if iv > 0 else 0.15, otype)
            side["iv"] = round(iv * 100, 2)  # as percentage
            side.update(greeks)
            iv_computed += 1

    print(f"  IV + greeks computed for {iv_computed} contracts")

    # Build final sorted list
    normalised = []
    for sp in sorted(strikes_map.keys()):
        normalised.append({
            "strike": sp,
            "CE": strikes_map[sp]["CE"],
            "PE": strikes_map[sp]["PE"],
        })

    pcr = round(total_put_oi / total_call_oi, 3) if total_call_oi else 0

    output = {
        "status": "ok",
        "symbol": symbol,
        "fetched_at": datetime.now().isoformat(),
        "expiry_type": "monthly" if is_stock else "weekly",
        "expiry_dates": expiry_data,
        "total_call_oi": total_call_oi,
        "total_put_oi": total_put_oi,
        "pcr": pcr,
        "india_vix": india_vix,
        "strike_count": len(normalised),
        "chain": normalised,
    }

    out_path = os.path.join(symbol_dir, "option_chain.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"  Option chain: {len(normalised)} strikes saved (PCR: {pcr})")
    return True
    print(f"  Saved to: {out_path}")


def update_meta(symbol, symbol_dir, fetched_price=False, fetched_oi=False):
    meta_path = os.path.join(symbol_dir, "meta.json")
    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            meta = json.load(f)

    now = datetime.now()
    meta["symbol"] = symbol
    if fetched_price:
        meta["price_fetched_at"] = now.isoformat()
        meta["price_fetched_at_human"] = now.strftime("%Y-%m-%d %H:%M:%S")
    if fetched_oi:
        meta["oi_fetched_at"] = now.isoformat()
        meta["oi_fetched_at_human"] = now.strftime("%Y-%m-%d %H:%M:%S")

    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python fyers_prefetch.py <symbol>              # price data only")
        print("  python fyers_prefetch.py <symbol> --oi         # option chain only")
        print("  python fyers_prefetch.py <symbol> --all        # price + option chain")
        print()
        print("Examples:")
        print("  python fyers_prefetch.py NSE:NIFTY50-INDEX")
        print("  python fyers_prefetch.py NSE:NIFTY50-INDEX --oi")
        print("  python fyers_prefetch.py NSE:NIFTYBANK-INDEX --all")
        print("  python fyers_prefetch.py NSE:RELIANCE-EQ --all")
        sys.exit(1)

    symbol = sys.argv[1].upper()
    flags = [a.lower() for a in sys.argv[2:]]

    fetch_price = "--oi" not in flags  # default to price unless --oi only
    fetch_oi = "--oi" in flags or "--all" in flags

    config = load_config()
    client = get_client(config)

    symbol_dir = os.path.join(DATA_DIR, safe_symbol_dir(symbol))
    os.makedirs(symbol_dir, exist_ok=True)

    print(f"\nFetching data for {symbol}...")

    if fetch_price:
        print("\n-- Price data --")
        fetch_price_data(client, symbol, symbol_dir)

    oi_ok = True
    if fetch_oi:
        print("\n-- Option chain --")
        oi_ok = fetch_option_chain(client, symbol, symbol_dir) is not False

    update_meta(symbol, symbol_dir, fetched_price=fetch_price, fetched_oi=fetch_oi and oi_ok)

    if fetch_oi and not oi_ok:
        print(f"\nFailed. Option chain not saved for {symbol}.")
        sys.exit(1)

    print(f"\nDone. Data saved to: {symbol_dir}")
    if fetch_price:
        print("You can now use /analysis or /post in Claude.")
    if fetch_oi:
        print("You can now use /oi in Claude.")


if __name__ == "__main__":
    main()
