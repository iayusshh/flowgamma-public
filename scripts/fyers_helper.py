#!/usr/bin/env python3
"""
FYERS API Helper Script
Used by /post and /analysis skills to fetch live market data.

Usage:
  python fyers_helper.py quote NSE:RELIANCE-EQ
  python fyers_helper.py candles NSE:RELIANCE-EQ D 30
  python fyers_helper.py candles NSE:NIFTY50-INDEX W 52
  python fyers_helper.py depth NSE:RELIANCE-EQ

Resolutions: 1, 2, 3, 5, 10, 15, 20, 30, 60, 120, 240, D, W, M
"""

import sys
import json
import os
from datetime import datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.environ.get("FYERS_CONFIG_PATH", os.path.join(SCRIPT_DIR, "fyers_config.json"))


def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def get_client(config):
    """Initialize FYERS client with stored token."""
    from fyers_apiv3 import fyersModel

    token_path = config.get("token_path", "/tmp/fyers_token.json")

    if not os.path.exists(token_path):
        print("ERROR: No access token found. Please authenticate first.")
        print("Run: python fyers_helper.py auth")
        sys.exit(1)

    with open(token_path, "r") as f:
        token_data = json.load(f)

    access_token = token_data.get("access_token")
    if not access_token:
        print("ERROR: Access token is empty. Please re-authenticate.")
        print("Run: python fyers_helper.py auth")
        sys.exit(1)

    client = fyersModel.FyersModel(
        client_id=config["app_id"],
        is_async=False,
        token=access_token,
        log_path=""
    )

    # Quick validation -- try profile
    try:
        resp = client.get_profile()
        if resp.get("code") != 200 and resp.get("s") != "ok":
            # Token might be expired
            print("ERROR: Token expired or invalid. Please re-authenticate.")
            print("Run: python fyers_helper.py auth")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: Could not validate token: {e}")
        print("Run: python fyers_helper.py auth")
        sys.exit(1)

    return client


def cmd_auth(config):
    """Generate auth URL for user to authenticate."""
    from fyers_apiv3 import fyersModel

    session = fyersModel.SessionModel(
        client_id=config["app_id"],
        secret_key=config["secret_key"],
        redirect_uri=config["redirect_uri"],
        response_type="code",
        grant_type="authorization_code"
    )

    auth_url = session.generate_authcode()
    print("AUTH_URL:" + auth_url)
    print("")
    print("Open the URL above in your browser, log in, and you'll be redirected.")
    print("Copy the 'auth_code' from the redirect URL and run:")
    print("  python fyers_helper.py token <auth_code>")


def cmd_token(config, auth_code):
    """Exchange auth code for access token."""
    from fyers_apiv3 import fyersModel

    session = fyersModel.SessionModel(
        client_id=config["app_id"],
        secret_key=config["secret_key"],
        redirect_uri=config["redirect_uri"],
        response_type="code",
        grant_type="authorization_code"
    )

    session.set_token(auth_code)
    response = session.generate_token()

    if "access_token" in response:
        token_path = config.get("token_path", "/tmp/fyers_token.json")
        token_data = {
            "access_token": response["access_token"],
            "generated_at": datetime.now().isoformat(),
        }
        with open(token_path, "w") as f:
            json.dump(token_data, f, indent=2)
        print("TOKEN_SAVED: Authentication successful. Token stored.")
    else:
        print(f"ERROR: Token generation failed: {json.dumps(response)}")
        sys.exit(1)


def cmd_quote(config, symbols):
    """Fetch live quotes. symbols is comma-separated."""
    client = get_client(config)

    symbol_list = [s.strip() for s in symbols.split(",")]
    data = {"symbols": ",".join(symbol_list)}

    response = client.quotes(data)

    if response.get("code") == 200 or response.get("s") == "ok":
        output = {"status": "ok", "quotes": []}
        for item in response.get("d", []):
            v = item.get("v", {})
            output["quotes"].append({
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
                "short_name": v.get("short_name", ""),
                "description": v.get("description", ""),
            })
        print(json.dumps(output, indent=2))
    else:
        print(json.dumps({"status": "error", "response": response}, indent=2))
        sys.exit(1)


def cmd_candles(config, symbol, resolution, days):
    """Fetch historical OHLC candles."""
    client = get_client(config)

    days = int(days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    # FYERS date format: YYYY-MM-DD
    data = {
        "symbol": symbol,
        "resolution": resolution,
        "date_format": "1",  # 1 = epoch timestamps
        "range_from": start_date.strftime("%Y-%m-%d"),
        "range_to": end_date.strftime("%Y-%m-%d"),
        "cont_flag": "1",  # continuous data for derivatives
    }

    response = client.history(data)

    if response.get("code") == 200 or response.get("s") == "ok":
        candles = response.get("candles", [])
        output = {
            "status": "ok",
            "symbol": symbol,
            "resolution": resolution,
            "count": len(candles),
            "candles": []
        }
        for c in candles:
            # FYERS returns: [timestamp, open, high, low, close, volume]
            output["candles"].append({
                "timestamp": c[0],
                "date": datetime.fromtimestamp(c[0]).strftime("%Y-%m-%d %H:%M"),
                "open": c[1],
                "high": c[2],
                "low": c[3],
                "close": c[4],
                "volume": c[5],
            })
        print(json.dumps(output, indent=2))
    else:
        print(json.dumps({"status": "error", "response": response}, indent=2))
        sys.exit(1)


def cmd_depth(config, symbol):
    """Fetch market depth (bid/ask)."""
    client = get_client(config)

    data = {"symbol": symbol, "ohlcv_flag": "1"}
    response = client.depth(data)

    if response.get("code") == 200 or response.get("s") == "ok":
        d = response.get("d", {})
        # Extract the relevant parts
        output = {
            "status": "ok",
            "symbol": symbol,
        }
        # Handle both dict and list formats
        if isinstance(d, dict):
            output["data"] = d
        elif isinstance(d, list) and len(d) > 0:
            output["data"] = d[0]
        else:
            output["data"] = d
        print(json.dumps(output, indent=2, default=str))
    else:
        print(json.dumps({"status": "error", "response": response}, indent=2))
        sys.exit(1)


def print_usage():
    print("""FYERS API Helper

Commands:
  auth                              Generate auth URL (first-time setup)
  token <auth_code>                 Exchange auth code for access token
  quote <symbols>                   Live quotes (comma-separated symbols)
  candles <symbol> <res> <days>     Historical OHLC candles
  depth <symbol>                    Market depth (bid/ask)

Symbol format:  NSE:RELIANCE-EQ, NSE:NIFTY50-INDEX, NSE:NIFTY24MARFUT
Resolutions:    1, 2, 3, 5, 10, 15, 20, 30, 60, 120, 240, D, W, M

Examples:
  python fyers_helper.py quote NSE:RELIANCE-EQ
  python fyers_helper.py candles NSE:RELIANCE-EQ D 30
  python fyers_helper.py candles NSE:NIFTY50-INDEX W 52
  python fyers_helper.py depth NSE:SBIN-EQ
""")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    config = load_config()
    command = sys.argv[1].lower()

    if command == "auth":
        cmd_auth(config)
    elif command == "token":
        if len(sys.argv) < 3:
            print("ERROR: Provide auth_code. Usage: python fyers_helper.py token <auth_code>")
            sys.exit(1)
        cmd_token(config, sys.argv[2])
    elif command == "quote":
        if len(sys.argv) < 3:
            print("ERROR: Provide symbols. Usage: python fyers_helper.py quote NSE:RELIANCE-EQ")
            sys.exit(1)
        cmd_quote(config, sys.argv[2])
    elif command == "candles":
        if len(sys.argv) < 5:
            print("ERROR: Usage: python fyers_helper.py candles <symbol> <resolution> <days>")
            sys.exit(1)
        cmd_candles(config, sys.argv[2], sys.argv[3], sys.argv[4])
    elif command == "depth":
        if len(sys.argv) < 3:
            print("ERROR: Provide symbol. Usage: python fyers_helper.py depth NSE:RELIANCE-EQ")
            sys.exit(1)
        cmd_depth(config, sys.argv[2])
    else:
        print(f"ERROR: Unknown command '{command}'")
        print_usage()
        sys.exit(1)
