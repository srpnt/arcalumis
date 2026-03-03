"""
Morpho GraphQL API client for the dashboard.
Fetches live market and vault data from https://api.morpho.org/graphql.
"""

import json
import time
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

MORPHO_API = "https://api.morpho.org/graphql"
REQUEST_TIMEOUT = 30

CHAIN_NAMES = {1: "Ethereum", 8453: "Base"}

# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

MARKETS_QUERY = """
query TopMarkets($first: Int!, $chains: [Int!]!) {
  markets(
    first: $first
    orderBy: SupplyAssetsUsd
    orderDirection: Desc
    where: { chainId_in: $chains, listed: true }
  ) {
    items {
      uniqueKey
      lltv
      loanAsset { symbol priceUsd }
      collateralAsset { symbol priceUsd }
      morphoBlue { chain { id } }
      state {
        borrowAssetsUsd
        supplyAssetsUsd
        liquidityAssetsUsd
        utilization
        borrowApy
        supplyApy
        fee
        rewards {
          asset { symbol }
          supplyApr
          borrowApr
        }
      }
    }
  }
}
"""

VAULTS_QUERY = """
query TopVaults($first: Int!, $chains: [Int!]!) {
  vaults(
    first: $first
    orderBy: TotalAssetsUsd
    orderDirection: Desc
    where: { chainId_in: $chains, listed: true }
  ) {
    items {
      address
      symbol
      name
      chain { id network }
      asset { symbol priceUsd }
      state {
        totalAssetsUsd
        fee
        apy
        netApy
        allocation {
          market {
            uniqueKey
            loanAsset { symbol }
            collateralAsset { symbol }
          }
          supplyAssetsUsd
        }
      }
      metadata { description }
    }
  }
}
"""


# ---------------------------------------------------------------------------
# Transport
# ---------------------------------------------------------------------------

class MorphoAPIError(Exception):
    pass


def _graphql(query: str, variables: dict | None = None) -> dict:
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = Request(
        MORPHO_API,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            body = json.loads(resp.read().decode())
    except HTTPError as e:
        raise MorphoAPIError(f"HTTP {e.code}: {e.reason}") from e
    except URLError as e:
        raise MorphoAPIError(f"Connection error: {e.reason}") from e

    if "errors" in body:
        msgs = [e.get("message", str(e)) for e in body["errors"]]
        raise MorphoAPIError(f"GraphQL errors: {'; '.join(msgs)}")
    return body.get("data", {})


def _sf(val, default=0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_markets(chains: list[int] | None = None, top_n: int = 50) -> list[dict]:
    """Fetch top markets, return list of dicts."""
    chains = chains or [1, 8453]
    data = _graphql(MARKETS_QUERY, {"first": top_n, "chains": chains})
    items = data.get("markets", {}).get("items", [])
    results = []
    for m in items:
        state = m.get("state") or {}
        loan = m.get("loanAsset") or {}
        coll = m.get("collateralAsset") or {}
        morpho_blue = m.get("morphoBlue") or {}
        chain_obj = morpho_blue.get("chain") or {}
        chain_id = chain_obj.get("id")

        supply_apy = _sf(state.get("supplyApy"))
        borrow_apy = _sf(state.get("borrowApy"))

        # Filter out spam/broken markets (>100% APY is likely garbage)
        if supply_apy > 1.0 or borrow_apy > 1.0:
            continue

        rewards = []
        for r in state.get("rewards") or []:
            asset = r.get("asset") or {}
            rewards.append({
                "asset": asset.get("symbol", "?"),
                "supply_apr": _sf(r.get("supplyApr")),
                "borrow_apr": _sf(r.get("borrowApr")),
            })

        coll_symbol = coll.get("symbol", "—")
        loan_symbol = loan.get("symbol", "?")

        results.append({
            "unique_key": m.get("uniqueKey", ""),
            "chain_id": chain_id,
            "chain": CHAIN_NAMES.get(chain_id, str(chain_id or "?")),
            "loan_asset": loan_symbol,
            "collateral_asset": coll_symbol,
            "pair": f"{coll_symbol}/{loan_symbol}",
            "supply_usd": _sf(state.get("supplyAssetsUsd")),
            "borrow_usd": _sf(state.get("borrowAssetsUsd")),
            "liquidity_usd": _sf(state.get("liquidityAssetsUsd")),
            "utilization": _sf(state.get("utilization")),
            "supply_apy": supply_apy,
            "borrow_apy": borrow_apy,
            "fee": _sf(state.get("fee")),
            "lltv": _sf(m.get("lltv")),
            "rewards": rewards,
        })
    return results


def fetch_vaults(chains: list[int] | None = None, top_n: int = 50) -> list[dict]:
    """Fetch top vaults, return list of dicts."""
    chains = chains or [1, 8453]
    data = _graphql(VAULTS_QUERY, {"first": top_n, "chains": chains})
    items = data.get("vaults", {}).get("items", [])
    results = []
    for v in items:
        state = v.get("state") or {}
        chain = v.get("chain") or {}
        asset = v.get("asset") or {}
        meta = v.get("metadata") or {}
        allocation = state.get("allocation") or []

        apy = _sf(state.get("apy"))
        net_apy = _sf(state.get("netApy"))

        # Filter spam
        if apy > 1.0 or net_apy > 1.0:
            continue

        results.append({
            "address": v.get("address", ""),
            "name": v.get("name", ""),
            "symbol": v.get("symbol", ""),
            "chain_id": chain.get("id"),
            "chain": CHAIN_NAMES.get(chain.get("id"), chain.get("network", "?")),
            "underlying_asset": asset.get("symbol", "?"),
            "total_assets_usd": _sf(state.get("totalAssetsUsd")),
            "apy": apy,
            "net_apy": net_apy,
            "fee": _sf(state.get("fee")),
            "description": (meta.get("description") or "")[:200],
            "num_markets": len(allocation),
        })
    return results


def fetch_all(top_n: int = 50) -> dict:
    """Fetch everything, return timestamped bundle."""
    markets = fetch_markets(top_n=top_n)
    vaults = fetch_vaults(top_n=top_n)
    return {
        "timestamp": int(time.time()),
        "markets": markets,
        "vaults": vaults,
    }
