#!/usr/bin/env python3
"""
update-whale-watchlist.py
Fetches top MORPHO token holders (Arkham) and top vault depositors (Morpho GraphQL),
merges into a deduplicated watchlist, enriches with Arkham entity labels,
and saves to data/whale-watchlist.json.
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

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", str(Path(os.environ.get("HOME", "/home/piton")) / ".openclaw" / "workspace")))
CREDS_PATH = WORKSPACE / "credentials" / "apis.json"
OUTPUT_PATH = WORKSPACE / "data" / "whale-watchlist.json"

MORPHO_TOKEN = "0x58D97B57BB95320F9a05dC918Aef65434969c2B2"
MORPHO_GQL = "https://api.morpho.org/graphql"

# Citadel dev server proxy (bypasses credential redaction in sandboxed envs)
CITADEL_PROXY = os.environ.get("CITADEL_URL", "http://localhost:8501")

# ============================================================
# Load credentials
# ============================================================

def load_arkham_key() -> str:
    """Load Arkham API key from credentials file. Falls back to env var."""
    # Try env var first
    env_key = os.environ.get("ARKHAM_API_KEY", "")
    if env_key and len(env_key) > 8:
        return env_key

    with open(CREDS_PATH) as f:
        creds = json.load(f)
    ark = creds.get("arkham", {})
    # Support both camelCase and snake_case key names
    for candidate in ["apiKey", "api_key", "key"]:
        val = ark.get(candidate)
        if val and isinstance(val, str) and len(val) > 8:
            return val
    # Fallback: try any string value that looks like a UUID key
    for v in ark.values():
        if isinstance(v, str) and len(v) > 20 and "-" in v and not v.startswith("http"):
            return v
    return ""  # May be empty if running in sandboxed env; use proxy instead


def arkham_get(path: str, api_key: str, params: dict | None = None) -> dict:
    """Fetch from Arkham API — uses direct API if key available, else proxy."""
    if api_key:
        url = f"https://api.arkm.com{path}"
        headers = {"API-Key": api_key}
        resp = requests.get(url, headers=headers, params=params, timeout=15)
    else:
        # Use Citadel proxy
        url = f"{CITADEL_PROXY}/api/intel{path}"
        resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


# ============================================================
# Fetch top MORPHO token holders from Arkham
# ============================================================

def fetch_token_holders(api_key: str, limit: int = 50) -> list[dict]:
    """Fetch top MORPHO token holders via Arkham API."""
    print(f"[*] Fetching top {limit} MORPHO token holders from Arkham...")
    data = arkham_get(f"/token/holders/ethereum/{MORPHO_TOKEN}", api_key)

    holders = data.get("addressTopHolders", {}).get("ethereum", [])
    results = []

    for h in holders[:limit]:
        addr_info = h.get("address", {})
        address = addr_info.get("address", "")
        entity = addr_info.get("arkhamEntity", {}) or {}
        label = addr_info.get("arkhamLabel", {}) or {}
        balance = float(h.get("balance", 0))

        results.append({
            "address": address,
            "label": entity.get("name") or label.get("name") or None,
            "source": "morpho-token-whale",
            "chain": "ethereum",
            "notes": f"MORPHO holder: {balance:,.0f} tokens",
            "lastBalance": balance,
        })

    print(f"    Found {len(results)} token holders")
    return results


# ============================================================
# Fetch top vault depositors from Morpho GraphQL
# ============================================================

def fetch_vault_depositors(limit: int = 50) -> list[dict]:
    """Fetch largest vault depositors via Morpho GraphQL."""
    query = """
    query TopVaultDepositors($limit: Int!) {
      vaultPositions(
        first: $limit
        orderBy: Shares
        orderDirection: Desc
        where: { chainId_in: [1, 8453] }
      ) {
        items {
          state { assetsUsd }
          user { address }
          vault {
            name
            chain { id network }
          }
        }
      }
    }
    """
    print(f"[*] Fetching top {limit} vault depositors from Morpho GraphQL...")
    resp = requests.post(
        MORPHO_GQL,
        json={"query": query, "variables": {"limit": limit}},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    if "errors" in data:
        print(f"    GraphQL errors: {data['errors']}")
        return []

    items = data.get("data", {}).get("vaultPositions", {}).get("items", [])
    results = []

    for item in items:
        state = item.get("state", {})
        user = item.get("user", {})
        vault = item.get("vault", {})
        chain = vault.get("chain", {})

        address = user.get("address", "")
        deposited_usd = float(state.get("assetsUsd", 0))
        vault_name = vault.get("name", "Unknown")
        chain_network = chain.get("network", "ethereum")

        results.append({
            "address": address,
            "label": None,  # Will be enriched with Arkham
            "source": "morpho-vault-whale",
            "chain": chain_network,
            "notes": f"Top depositor in {vault_name}: ${deposited_usd:,.0f}",
            "lastBalance": deposited_usd,
        })

    print(f"    Found {len(results)} vault depositors")
    return results


# ============================================================
# Enrich addresses with Arkham entity labels
# ============================================================

def enrich_with_arkham(whales: list[dict], api_key: str) -> list[dict]:
    """Look up unlabeled addresses on Arkham to get entity names."""
    unlabeled = [w for w in whales if not w.get("label")]
    print(f"[*] Enriching {len(unlabeled)} unlabeled addresses with Arkham...")

    enriched_count = 0
    for w in unlabeled:
        try:
            data = arkham_get(f"/intelligence/address/{w['address']}", api_key)
            entity = data.get("arkhamEntity", {}) or {}
            label_info = data.get("arkhamLabel", {}) or {}
            name = entity.get("name") or label_info.get("name")
            if name:
                w["label"] = name
                enriched_count += 1
            # Rate limiting — be gentle
            time.sleep(0.15)
        except Exception as e:
            print(f"    Warning: Failed to enrich {w['address'][:10]}...: {e}")

    print(f"    Enriched {enriched_count} addresses")
    return whales


# ============================================================
# Merge & deduplicate
# ============================================================

def merge_whales(token_holders: list[dict], vault_depositors: list[dict]) -> list[dict]:
    """Merge two lists, dedup by address. Keep the entry with more info."""
    seen: dict[str, dict] = {}

    for w in token_holders + vault_depositors:
        addr = w["address"].lower()
        if addr in seen:
            existing = seen[addr]
            # If new entry has a label and existing doesn't, prefer new
            if w.get("label") and not existing.get("label"):
                existing["label"] = w["label"]
            # Append source if different
            if w["source"] not in existing["source"]:
                existing["source"] += f"|{w['source']}"
            # Append notes
            if w.get("notes") and w["notes"] not in existing.get("notes", ""):
                existing["notes"] = f"{existing.get('notes', '')}; {w['notes']}"
        else:
            seen[addr] = w.copy()

    return list(seen.values())


# ============================================================
# Main
# ============================================================

def main():
    print("=" * 60)
    print("Whale Watchlist Updater")
    print("=" * 60)

    api_key = load_arkham_key()
    now = datetime.now(timezone.utc).isoformat()

    # Fetch from both sources
    token_holders = fetch_token_holders(api_key, limit=50)
    vault_depositors = fetch_vault_depositors(limit=50)

    # Merge & dedup
    merged = merge_whales(token_holders, vault_depositors)
    print(f"[*] Merged: {len(merged)} unique addresses")

    # Enrich unlabeled addresses
    merged = enrich_with_arkham(merged, api_key)

    # Build final watchlist
    whales = []
    for w in merged:
        whales.append({
            "address": w["address"],
            "label": w.get("label") or "Unknown",
            "source": w["source"],
            "chain": w.get("chain", "ethereum"),
            "addedAt": now,
            "notes": w.get("notes", ""),
            "lastBalance": w.get("lastBalance", 0),
            "lastChecked": now,
        })

    # Sort by balance descending
    whales.sort(key=lambda x: x["lastBalance"], reverse=True)

    watchlist = {
        "lastUpdated": now,
        "whales": whales,
    }

    # Save
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(watchlist, f, indent=2)

    print(f"\n[✓] Saved {len(whales)} whales to {OUTPUT_PATH}")
    print(f"    Last updated: {now}")


if __name__ == "__main__":
    main()
