#!/usr/bin/env python3
"""
Hand-crafts a signed Rasagram/Telegram Mini App initData string, for testing
the telegram-webapp auth guard (app/support/telegramauth) without needing a
real client launch. Same algorithm as computeHash/generateDataCheckString in
teamgram.io/bots' messages.requestWebView_handler.go.

Usage:
    python3 scripts/sign_init_data.py [--id 123456789] [--first-name Ali] [--username ali]

Reads RASAGRAM_BOT_TOKEN from .env in the same directory unless --bot-token
is passed explicitly. Prints a ready-to-use `Authorization: Bearer ...` line.
"""
import argparse
import hashlib
import hmac
import json
import re
import time
import urllib.parse
from pathlib import Path


def read_bot_token_from_env() -> str:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return ""
    match = re.search(r"^RASAGRAM_BOT_TOKEN=(.*)$", env_path.read_text(), re.MULTILINE)
    return match.group(1).strip() if match else ""


def sign(bot_token: str, params: dict) -> str:
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode({**params, "hash": computed_hash})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bot-token", default=None, help="Overrides RASAGRAM_BOT_TOKEN from .env")
    parser.add_argument("--id", type=int, default=123456789, help="Fake user id")
    parser.add_argument("--first-name", default="Ali")
    parser.add_argument("--last-name", default="Rezaei")
    parser.add_argument("--username", default="ali")
    parser.add_argument("--language-code", default="fa")
    parser.add_argument("--stale-seconds", type=int, default=0, help="Backdate auth_date to test staleness rejection")
    parser.add_argument("--host", default="http://127.0.0.1:3000", help="Used only to print a ready-to-run curl command")
    parser.add_argument(
        "--frontend-host", default="http://localhost:5173", help="Used only to print a ready-to-open browser URL"
    )
    args = parser.parse_args()

    bot_token = args.bot_token or read_bot_token_from_env()
    if not bot_token:
        raise SystemExit("No bot token: pass --bot-token or set RASAGRAM_BOT_TOKEN in .env")

    user = json.dumps(
        {
            "id": args.id,
            "first_name": args.first_name,
            "last_name": args.last_name,
            "username": args.username,
            "language_code": args.language_code,
        },
        separators=(",", ":"),
    )
    params = {
        "query_id": "AAF45E1LAAAAAHjkTUtKkRwV",
        "auth_date": str(int(time.time()) - args.stale_seconds),
        "user": user,
    }
    init_data = sign(bot_token, params)

    print(init_data)
    print()
    print(f'curl -s -w "\\nHTTP %{{http_code}}\\n" {args.host}/api/v1/me -H "Authorization: Bearer {init_data}"')
    print()
    # init_data itself contains unescaped &/= characters (it's a query string
    # in its own right), so it can't go into another URL's query string
    # as-is — the outer URL parser would split it into several unrelated
    # params at the first &, and the frontend would only ever see the
    # fragment before that (typically missing `hash` entirely, which is
    # exactly the "initData has no hash field" error this trips people into).
    # It has to be percent-encoded a second time so it round-trips as a
    # single opaque value.
    encoded = urllib.parse.quote(init_data, safe="")
    print(f"{args.frontend_host}/?initData={encoded}")


if __name__ == "__main__":
    main()
