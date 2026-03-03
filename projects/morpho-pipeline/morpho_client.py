"""
Morpho Protocol Data Client
============================
Fetches market and vault data from the Morpho GraphQL API.
Supports Ethereum (chain 1) and Base (chain 8453).

Usage:
    python morpho_client.py                    # Full snapshot (markets + vaults)
    python morpho_client.py markets            # Markets only
    python morpho_client.py vaults             # Vaults only
    python morpho_client.py market <uniqueKey> # Single market detail
    python morpho_client.py vault <address>    # Single vault detail
    python morpho_client.py --chain 8453       # Base only
    python morpho_client.py --top 20           # Top 20 by TVL
    python morpho_client.py --json             # Raw JSON output
"""

import json
import sys
import time
import logging
from dataclasses import dataclass, field, asdict
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MORPHO_API = "https://api.morpho.org/graphql"
DEFAULT_CHAINS = [1, 8453]  # Ethereum, Base
DEFAULT_TOP_N = 50
REQUEST_TIMEOUT = 30  # seconds

CHAIN_NAMES = {
    1: "Ethereum",
    8453: "Base",
    42161: "Arbitrum",
    10: "OP Mainnet",
    137: "Polygon",
}

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("morpho")


# ---------------------------------------------------------------------------
# GraphQL queries
# ---------------------------------------------------------------------------

MARKETS_QUERY = """
query TopMarkets($first: Int!, $chains: [Int!]!) {
  markets(
    first: $first
    orderBy: SupplyAssetsUsd
    orderDirection: Desc
    where: { chainId_in: $chains, whitelisted: true }
  ) {
    items {
      uniqueKey
      lltv
      loanAsset {
        address
        symbol
        decimals
        priceUsd
      }
      collateralAsset {
        address
        symbol
        decimals
        priceUsd
      }
      oracleAddress
      irmAddress
      state {
        borrowAssets
        borrowAssetsUsd
        supplyAssets
        supplyAssetsUsd
        collateralAssets
        collateralAssetsUsd
        liquidityAssets
        liquidityAssetsUsd
        fee
        utilization
        borrowApy
        supplyApy
        rewards {
          asset { address symbol }
          supplyApr
          borrowApr
        }
      }
      warnings {
        type
        level
      }
    }
    pageInfo {
      count
      countTotal
    }
  }
}
"""

SINGLE_MARKET_QUERY = """
query MarketDetail($uniqueKey: String!, $chainId: Int) {
  marketByUniqueKey(uniqueKey: $uniqueKey, chainId: $chainId) {
    uniqueKey
    lltv
    loanAsset {
      address
      symbol
      decimals
      priceUsd
    }
    collateralAsset {
      address
      symbol
      decimals
      priceUsd
    }
    oracleAddress
    irmAddress
    state {
      borrowAssets
      borrowAssetsUsd
      supplyAssets
      supplyAssetsUsd
      collateralAssets
      collateralAssetsUsd
      liquidityAssets
      liquidityAssetsUsd
      fee
      utilization
      borrowApy
      supplyApy
      avgBorrowApy
      avgSupplyApy
      rewards {
        asset { address symbol }
        supplyApr
        borrowApr
      }
    }
    supplyingVaults {
      address
      symbol
      name
    }
    warnings {
      type
      level
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
    where: { chainId_in: $chains }
  ) {
    items {
      address
      symbol
      name
      chain { id network }
      asset {
        address
        symbol
        priceUsd
        yield { apr }
      }
      state {
        totalAssets
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
      metadata {
        description
      }
    }
    pageInfo {
      count
      countTotal
    }
  }
}
"""

SINGLE_VAULT_QUERY = """
query VaultDetail($address: String!, $chainId: Int!) {
  vaultByAddress(address: $address, chainId: $chainId) {
    address
    symbol
    name
    chain { id network }
    asset {
      address
      symbol
      priceUsd
      yield { apr }
    }
    state {
      totalAssets
      totalAssetsUsd
      fee
      apy
      netApy
      curator { address }
      allocation {
        market {
          uniqueKey
          loanAsset { symbol }
          collateralAsset { symbol }
          state {
            supplyApy
            utilization
          }
        }
        supplyAssetsUsd
        supplyQueueIndex
        withdrawQueueIndex
      }
    }
    metadata {
      description
      forumLink
    }
  }
}
"""


# ---------------------------------------------------------------------------
# HTTP / GraphQL transport
# ---------------------------------------------------------------------------

class MorphoAPIError(Exception):
    """Raised when the Morpho API returns errors."""
    pass


def _graphql_request(query: str, variables: Optional[dict] = None) -> dict:
    """Execute a GraphQL query against the Morpho API."""
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


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class MarketSummary:
    unique_key: str
    chain_id: Optional[int] = None
    loan_asset: str = ""
    collateral_asset: str = ""
    lltv: float = 0.0
    supply_usd: float = 0.0
    borrow_usd: float = 0.0
    liquidity_usd: float = 0.0
    utilization: float = 0.0
    supply_apy: float = 0.0
    borrow_apy: float = 0.0
    fee: float = 0.0
    rewards: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


@dataclass
class VaultSummary:
    address: str
    name: str = ""
    symbol: str = ""
    chain_id: Optional[int] = None
    chain_name: str = ""
    underlying_asset: str = ""
    total_assets_usd: float = 0.0
    apy: float = 0.0
    net_apy: float = 0.0
    fee: float = 0.0
    description: str = ""
    num_markets: int = 0


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def _safe_float(val, default=0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _parse_market(item: dict) -> MarketSummary:
    state = item.get("state") or {}
    loan = item.get("loanAsset") or {}
    coll = item.get("collateralAsset") or {}
    warnings = item.get("warnings") or []

    rewards = []
    for r in state.get("rewards") or []:
        asset = r.get("asset") or {}
        rewards.append({
            "asset": asset.get("symbol", "?"),
            "supply_apr": _safe_float(r.get("supplyApr")),
            "borrow_apr": _safe_float(r.get("borrowApr")),
        })

    return MarketSummary(
        unique_key=item.get("uniqueKey", ""),
        loan_asset=loan.get("symbol", "?"),
        collateral_asset=coll.get("symbol", "?"),
        lltv=_safe_float(item.get("lltv")),
        supply_usd=_safe_float(state.get("supplyAssetsUsd")),
        borrow_usd=_safe_float(state.get("borrowAssetsUsd")),
        liquidity_usd=_safe_float(state.get("liquidityAssetsUsd")),
        utilization=_safe_float(state.get("utilization")),
        supply_apy=_safe_float(state.get("supplyApy")),
        borrow_apy=_safe_float(state.get("borrowApy")),
        fee=_safe_float(state.get("fee")),
        rewards=rewards,
        warnings=[{"type": w.get("type"), "level": w.get("level")} for w in warnings],
    )


def _parse_vault(item: dict) -> VaultSummary:
    state = item.get("state") or {}
    chain = item.get("chain") or {}
    asset = item.get("asset") or {}
    meta = item.get("metadata") or {}
    allocation = state.get("allocation") or []

    return VaultSummary(
        address=item.get("address", ""),
        name=item.get("name", ""),
        symbol=item.get("symbol", ""),
        chain_id=chain.get("id"),
        chain_name=chain.get("network", ""),
        underlying_asset=asset.get("symbol", "?"),
        total_assets_usd=_safe_float(state.get("totalAssetsUsd")),
        apy=_safe_float(state.get("apy")),
        net_apy=_safe_float(state.get("netApy")),
        fee=_safe_float(state.get("fee")),
        description=(meta.get("description") or "")[:200],
        num_markets=len(allocation),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class MorphoClient:
    """Client for fetching Morpho protocol data."""

    def __init__(self, chains: Optional[list[int]] = None, top_n: int = DEFAULT_TOP_N):
        self.chains = chains or DEFAULT_CHAINS
        self.top_n = top_n

    def fetch_markets(self) -> list[MarketSummary]:
        """Fetch top markets by supply TVL."""
        log.info(f"Fetching top {self.top_n} markets on chains {self.chains}...")
        data = _graphql_request(MARKETS_QUERY, {
            "first": self.top_n,
            "chains": self.chains,
        })
        markets_data = data.get("markets", {})
        items = markets_data.get("items", [])
        page_info = markets_data.get("pageInfo", {})
        log.info(f"Got {len(items)} markets (total on-chain: {page_info.get('countTotal', '?')})")
        return [_parse_market(m) for m in items]

    def fetch_market(self, unique_key: str, chain_id: Optional[int] = None) -> Optional[dict]:
        """Fetch a single market's full detail."""
        log.info(f"Fetching market {unique_key[:16]}...")
        variables = {"uniqueKey": unique_key}
        if chain_id:
            variables["chainId"] = chain_id
        data = _graphql_request(SINGLE_MARKET_QUERY, variables)
        return data.get("marketByUniqueKey")

    def fetch_vaults(self) -> list[VaultSummary]:
        """Fetch top vaults by total assets."""
        log.info(f"Fetching top {self.top_n} vaults on chains {self.chains}...")
        data = _graphql_request(VAULTS_QUERY, {
            "first": self.top_n,
            "chains": self.chains,
        })
        vaults_data = data.get("vaults", {})
        items = vaults_data.get("items", [])
        page_info = vaults_data.get("pageInfo", {})
        log.info(f"Got {len(items)} vaults (total: {page_info.get('countTotal', '?')})")
        return [_parse_vault(v) for v in items]

    def fetch_vault(self, address: str, chain_id: int = 1) -> Optional[dict]:
        """Fetch a single vault's full detail."""
        log.info(f"Fetching vault {address[:10]}...")
        data = _graphql_request(SINGLE_VAULT_QUERY, {
            "address": address,
            "chainId": chain_id,
        })
        return data.get("vaultByAddress")

    def snapshot(self) -> dict:
        """Full protocol snapshot: markets + vaults."""
        ts = int(time.time())
        markets = self.fetch_markets()
        vaults = self.fetch_vaults()

        total_supply = sum(m.supply_usd for m in markets)
        total_borrow = sum(m.borrow_usd for m in markets)
        total_vault_tvl = sum(v.total_assets_usd for v in vaults)

        return {
            "timestamp": ts,
            "chains": self.chains,
            "chain_names": [CHAIN_NAMES.get(c, str(c)) for c in self.chains],
            "summary": {
                "total_supply_usd": round(total_supply, 2),
                "total_borrow_usd": round(total_borrow, 2),
                "total_vault_tvl_usd": round(total_vault_tvl, 2),
                "markets_count": len(markets),
                "vaults_count": len(vaults),
                "avg_utilization": round(
                    sum(m.utilization for m in markets) / max(len(markets), 1), 4
                ),
            },
            "top_markets": [asdict(m) for m in markets[:10]],
            "top_vaults": [asdict(v) for v in vaults[:10]],
            "all_markets": [asdict(m) for m in markets],
            "all_vaults": [asdict(v) for v in vaults],
        }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _format_pct(val: float) -> str:
    return f"{val * 100:.2f}%"


def _format_usd(val: float) -> str:
    if val >= 1_000_000_000:
        return f"${val / 1e9:.2f}B"
    if val >= 1_000_000:
        return f"${val / 1e6:.2f}M"
    if val >= 1_000:
        return f"${val / 1e3:.1f}K"
    return f"${val:.2f}"


def _print_markets_table(markets: list[MarketSummary]):
    print(f"\n{'#':>3}  {'Pair':<25} {'Supply':>12} {'Borrow':>12} {'Util':>8} {'Supply APY':>11} {'Borrow APY':>11}")
    print("-" * 90)
    for i, m in enumerate(markets, 1):
        pair = f"{m.collateral_asset}/{m.loan_asset}"
        print(
            f"{i:>3}  {pair:<25} "
            f"{_format_usd(m.supply_usd):>12} "
            f"{_format_usd(m.borrow_usd):>12} "
            f"{_format_pct(m.utilization):>8} "
            f"{_format_pct(m.supply_apy):>11} "
            f"{_format_pct(m.borrow_apy):>11}"
        )


def _print_vaults_table(vaults: list[VaultSummary]):
    print(f"\n{'#':>3}  {'Vault':<35} {'Chain':<10} {'Asset':<8} {'TVL':>12} {'APY':>8} {'Net APY':>8} {'Markets':>7}")
    print("-" * 100)
    for i, v in enumerate(vaults, 1):
        name = v.name[:33] if v.name else v.address[:10]
        print(
            f"{i:>3}  {name:<35} "
            f"{v.chain_name:<10} "
            f"{v.underlying_asset:<8} "
            f"{_format_usd(v.total_assets_usd):>12} "
            f"{_format_pct(v.apy):>8} "
            f"{_format_pct(v.net_apy):>8} "
            f"{v.num_markets:>7}"
        )


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Morpho Protocol Data Pipeline")
    parser.add_argument("command", nargs="?", default="snapshot",
                        choices=["snapshot", "markets", "vaults", "market", "vault"],
                        help="What to fetch (default: snapshot)")
    parser.add_argument("target", nargs="?", default=None,
                        help="Market uniqueKey or vault address (for single lookups)")
    parser.add_argument("--chain", type=int, nargs="+", default=DEFAULT_CHAINS,
                        help=f"Chain IDs to query (default: {DEFAULT_CHAINS})")
    parser.add_argument("--top", type=int, default=DEFAULT_TOP_N,
                        help=f"Number of top results (default: {DEFAULT_TOP_N})")
    parser.add_argument("--json", action="store_true",
                        help="Output raw JSON instead of table")
    parser.add_argument("--output", "-o", type=str, default=None,
                        help="Write JSON output to file")

    args = parser.parse_args()
    client = MorphoClient(chains=args.chain, top_n=args.top)

    try:
        if args.command == "snapshot":
            result = client.snapshot()
            if args.json or args.output:
                output = json.dumps(result, indent=2)
                if args.output:
                    with open(args.output, "w") as f:
                        f.write(output)
                    print(f"Snapshot written to {args.output}")
                else:
                    print(output)
            else:
                s = result["summary"]
                print(f"\n=== Morpho Protocol Snapshot ===")
                print(f"Chains: {', '.join(result['chain_names'])}")
                print(f"Total Supply: {_format_usd(s['total_supply_usd'])}")
                print(f"Total Borrow: {_format_usd(s['total_borrow_usd'])}")
                print(f"Total Vault TVL: {_format_usd(s['total_vault_tvl_usd'])}")
                print(f"Markets: {s['markets_count']} | Vaults: {s['vaults_count']}")
                print(f"Avg Utilization: {_format_pct(s['avg_utilization'])}")
                _print_markets_table([MarketSummary(**m) for m in result["top_markets"]])
                _print_vaults_table([VaultSummary(**v) for v in result["top_vaults"]])

        elif args.command == "markets":
            markets = client.fetch_markets()
            if args.json:
                print(json.dumps([asdict(m) for m in markets], indent=2))
            else:
                _print_markets_table(markets)

        elif args.command == "vaults":
            vaults = client.fetch_vaults()
            if args.json:
                print(json.dumps([asdict(v) for v in vaults], indent=2))
            else:
                _print_vaults_table(vaults)

        elif args.command == "market":
            if not args.target:
                print("Error: provide a market uniqueKey", file=sys.stderr)
                sys.exit(1)
            chain_id = args.chain[0] if len(args.chain) == 1 else None
            result = client.fetch_market(args.target, chain_id)
            print(json.dumps(result, indent=2))

        elif args.command == "vault":
            if not args.target:
                print("Error: provide a vault address", file=sys.stderr)
                sys.exit(1)
            chain_id = args.chain[0] if len(args.chain) == 1 else 1
            result = client.fetch_vault(args.target, chain_id)
            print(json.dumps(result, indent=2))

    except MorphoAPIError as e:
        log.error(str(e))
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
