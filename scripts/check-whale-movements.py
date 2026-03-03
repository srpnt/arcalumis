#!/usr/bin/env python3
"""
check-whale-movements.py
Reads the whale watchlist, checks current balances via Arkham API,
compares with stored lastBalance, and flags significant movements (>10% change).
Saves results to data/whale-alerts.json.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# ============================================================
# Config
# ============================================================

WORKSPACE = Path(os.environ.get("HOME", "/home/piton")) / ".openclaw" / "workspace"
CREDS_PATH = WORKSPACE / "credentials" / "apis.json"
WATCHLIST_PATH = WORKSPACE / "data" / "whale-watchlist.json"
ALERTS_PATH = WORKSPACE / "data" / "whale-alerts.json"

MOVEMENT_THRESHOLD = 0.10  # 10% change triggers alert

# ============================================================
# Load credentials
# ============================================================

def load_arkham_key() -> str:
    with open(CREDS_PATH) as f:
        creds = json.load(f)
    ark = creds.get("arkham", {})
    # Support both camelCase and snake_case key names (env-dependent)
    for candidate in ["apiKey", "api_key", "key", "API_KEY"]:
        val = ark.get(candidate)
        if val and isinstance(val, str) and len(val) > 8:
            return val
    # Fallback: try any string value that looks like a key
    for v in ark.values():
        if isinstance(v, str) and len(v) > 20 and "-" in v:
            return v
    raise ValueError(f"No Arkham API key found in {list(ark.keys())}")


# ============================================================
# Load watchlist
# ============================================================

def load_watchlist() -> dict:
    if not WATCHLIST_PATH.exists():
        print("[!] Watchlist not found. Run update-whale-watchlist.py first.")
        sys.exit(1)

    with open(WATCHLIST_PATH) as f:
        return json.load(f)


# ============================================================
# Check balance for an address via Arkham
# ============================================================

def get_address_balance(address: str, api_key: str) -> float | None:
    """Get total USD balance for an address via Arkham API."""
    headers = {"API-Key": api_key}
    try:
        url = f"https://api.arkm.com/portfolio/v2/{address}"
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            return None

        data = resp.json()
        total_usd = 0.0

        # Portfolio v2 returns chains -> tokens -> balances
        chains = data.get("chains", {})
        if isinstance(chains, dict):
            for chain_data in chains.values():
                if not isinstance(chain_data, dict):
                    continue
                for token_info in chain_data.values():
                    if isinstance(token_info, dict):
                        total_usd += float(token_info.get("usdValue", 0) or token_info.get("valueUsd", 0) or 0)

        return total_usd
    except Exception as e:
        print(f"    Warning: Balance check failed for {address[:10]}...: {e}")
        return None


# ============================================================
# Main
# ============================================================

def main():
    print("=" * 60)
    print("Whale Movement Detector")
    print("=" * 60)

    api_key = load_arkham_key()
    watchlist = load_watchlist()
    whales = watchlist.get("whales", [])

    if not whales:
        print("[!] No whales in watchlist. Nothing to check.")
        return

    now = datetime.now(timezone.utc).isoformat()
    movements = []
    checked_count = 0
    skipped_count = 0

    print(f"[*] Checking {len(whales)} whale addresses for movements...")
    print(f"    Threshold: >{MOVEMENT_THRESHOLD*100:.0f}% balance change\n")

    for i, whale in enumerate(whales):
        address = whale["address"]
        label = whale.get("label", "Unknown")
        old_balance = float(whale.get("lastBalance", 0))

        # Skip if old balance is 0 (no baseline)
        if old_balance <= 0:
            skipped_count += 1
            continue

        # Fetch current balance
        current_balance = get_address_balance(address, api_key)
        if current_balance is None:
            skipped_count += 1
            continue

        checked_count += 1

        # Calculate change
        if old_balance > 0:
            change_pct = (current_balance - old_balance) / old_balance
        else:
            change_pct = 0.0

        # Check threshold
        if abs(change_pct) >= MOVEMENT_THRESHOLD:
            direction = "📈 INCREASE" if change_pct > 0 else "📉 DECREASE"
            print(f"  {direction}: {label} ({address[:10]}...)")
            print(f"    Old: ${old_balance:,.0f} → New: ${current_balance:,.0f} ({change_pct:+.1%})")

            movements.append({
                "address": address,
                "label": label,
                "chain": whale.get("chain", "ethereum"),
                "oldBalance": old_balance,
                "newBalance": current_balance,
                "changePct": round(change_pct * 100, 2),
                "direction": "increase" if change_pct > 0 else "decrease",
                "detectedAt": now,
                "source": whale.get("source", "unknown"),
            })

        # Update lastBalance and lastChecked in watchlist
        whale["lastBalance"] = current_balance
        whale["lastChecked"] = now

        # Rate limiting
        time.sleep(0.2)

        # Progress
        if (i + 1) % 10 == 0:
            print(f"    ... checked {i + 1}/{len(whales)}")

    # Save updated watchlist with new balances
    watchlist["lastUpdated"] = now
    with open(WATCHLIST_PATH, "w") as f:
        json.dump(watchlist, f, indent=2)

    # Save alerts
    alerts = {
        "lastChecked": now,
        "threshold": f"{MOVEMENT_THRESHOLD*100:.0f}%",
        "totalChecked": checked_count,
        "totalSkipped": skipped_count,
        "totalMovements": len(movements),
        "movements": movements,
    }

    ALERTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(ALERTS_PATH, "w") as f:
        json.dump(alerts, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"[✓] Results:")
    print(f"    Checked: {checked_count} addresses")
    print(f"    Skipped: {skipped_count} (no balance/failed)")
    print(f"    Movements detected: {len(movements)}")
    print(f"    Alerts saved to: {ALERTS_PATH}")
    print(f"    Watchlist updated: {WATCHLIST_PATH}")


if __name__ == "__main__":
    main()
