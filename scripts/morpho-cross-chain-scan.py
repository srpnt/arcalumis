#!/usr/bin/env python3
"""
Morpho Cross-Chain Rate Scanner
Finds supply/borrow rate differentials across all chains where Morpho is deployed.
"""

import json
import urllib.request
from collections import defaultdict

MORPHO_API = "https://api.morpho.org/graphql"

MARKETS_QUERY = """
query AllMarkets($first: Int!, $skip: Int!) {
  markets(
    first: $first
    skip: $skip
    orderBy: SupplyAssetsUsd
    orderDirection: Desc
    where: { listed: true }
  ) {
    items {
      uniqueKey
      lltv
      loanAsset { symbol address }
      collateralAsset { symbol address }
      morphoBlue { chain { id network } }
      state {
        supplyAssetsUsd
        borrowAssetsUsd
        liquidityAssetsUsd
        utilization
        supplyApy
        borrowApy
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

def fetch_markets(first=500, skip=0):
    payload = json.dumps({
        "query": MARKETS_QUERY,
        "variables": {"first": first, "skip": skip}
    }).encode()
    req = urllib.request.Request(
        MORPHO_API,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    if "errors" in data:
        print("GraphQL errors:", data["errors"])
        return []
    return data.get("data", {}).get("markets", {}).get("items", [])

def sf(val, fallback=0):
    if val is None:
        return fallback
    try:
        return float(val)
    except:
        return fallback

def main():
    print("Fetching Morpho markets across all chains...")
    all_markets = []
    for skip in range(0, 2000, 500):
        batch = fetch_markets(500, skip)
        if not batch:
            break
        all_markets.extend(batch)
        print(f"  Fetched {len(all_markets)} markets so far...")

    print(f"\nTotal markets fetched: {len(all_markets)}")

    # Group by loan asset, filter meaningful markets
    by_asset = defaultdict(list)
    for m in all_markets:
        loan = m.get("loanAsset") or {}
        coll = m.get("collateralAsset") or {}
        state = m.get("state") or {}
        chain = (m.get("morphoBlue") or {}).get("chain") or {}

        supply_usd = sf(state.get("supplyAssetsUsd"))
        borrow_usd = sf(state.get("borrowAssetsUsd"))
        supply_apy = sf(state.get("supplyApy"))
        borrow_apy = sf(state.get("borrowApy"))
        util = sf(state.get("utilization"))
        lltv = sf(m.get("lltv")) / 1e18 if m.get("lltv") else 0

        # Compute reward-adjusted APYs
        rewards = state.get("rewards") or []
        total_supply_reward = sum(sf(r.get("supplyApr")) for r in rewards)
        total_borrow_reward = sum(sf(r.get("borrowApr")) for r in rewards)

        if supply_usd < 50_000:  # skip tiny
            continue
        # Filter spam (>200% APY without rewards)
        if supply_apy > 2.0 and total_supply_reward == 0:
            continue

        by_asset[loan.get("symbol", "?")].append({
            "chain": chain.get("network", "?"),
            "chainId": chain.get("id", 0),
            "collateral": coll.get("symbol", "—"),
            "supplyUsd": supply_usd,
            "borrowUsd": borrow_usd,
            "supplyApy": supply_apy,
            "borrowApy": borrow_apy,
            "supplyApyWithRewards": supply_apy + total_supply_reward,
            "effectiveBorrowApy": borrow_apy - total_borrow_reward,  # rewards reduce cost
            "util": util,
            "lltv": lltv,
            "uniqueKey": m.get("uniqueKey", ""),
            "rewardSymbols": [r.get("asset", {}).get("symbol", "?") for r in rewards if sf(r.get("supplyApr")) > 0 or sf(r.get("borrowApr")) > 0],
        })

    # === CROSS-CHAIN ANALYSIS ===
    print("\n" + "=" * 80)
    print("MORPHO CROSS-CHAIN RATE ANALYSIS")
    print("=" * 80)

    # Only analyze assets present on multiple chains
    cross_chain_assets = {
        asset: markets for asset, markets in by_asset.items()
        if len(set(m["chain"] for m in markets)) >= 2
    }

    print(f"\nAssets on multiple chains: {len(cross_chain_assets)}")

    opportunities = []

    for asset in sorted(cross_chain_assets.keys(),
                        key=lambda a: sum(m["supplyUsd"] for m in cross_chain_assets[a]),
                        reverse=True):
        markets = cross_chain_assets[asset]
        chains = set(m["chain"] for m in markets)

        print(f"\n{'─' * 70}")
        print(f"  {asset} — deployed on {len(chains)} chains: {', '.join(sorted(chains))}")
        print(f"{'─' * 70}")

        # Per-chain summary
        by_chain = defaultdict(list)
        for m in markets:
            by_chain[m["chain"]].append(m)

        for chain in sorted(by_chain.keys()):
            cm = by_chain[chain]
            total_supply = sum(m["supplyUsd"] for m in cm)
            total_borrow = sum(m["borrowUsd"] for m in cm)
            best_supply = max(m["supplyApyWithRewards"] for m in cm)
            best_supply_raw = max(m["supplyApy"] for m in cm)
            lowest_borrow = min((m["borrowApy"] for m in cm if m["borrowApy"] > 0), default=0)
            lowest_eff_borrow = min((m["effectiveBorrowApy"] for m in cm if m["borrowApy"] > 0), default=0)

            reward_note = ""
            rewarded = [m for m in cm if m["rewardSymbols"]]
            if rewarded:
                all_rewards = set()
                for m in rewarded:
                    all_rewards.update(m["rewardSymbols"])
                reward_note = f" [rewards: {','.join(all_rewards)}]"

            print(f"    {chain:15s} | Supply TVL: ${total_supply/1e6:7.2f}M | Borrow: ${total_borrow/1e6:7.2f}M | "
                  f"Best Supply: {best_supply*100:6.2f}% | Lowest Borrow: {lowest_borrow*100:6.2f}% | "
                  f"Mkts: {len(cm):2d}{reward_note}")

        # Find cross-chain spreads
        # Strategy: Borrow on chain with lowest effective borrow rate,
        #           Supply on chain with highest supply rate (incl rewards)
        all_supply = []
        all_borrow = []
        for m in markets:
            if m["supplyApyWithRewards"] > 0 and m["supplyUsd"] > 100_000:
                all_supply.append(m)
            if m["borrowApy"] > 0 and m["borrowUsd"] > 50_000:
                all_borrow.append(m)

        if not all_supply or not all_borrow:
            continue

        # Find best cross-chain opportunities
        for s in sorted(all_supply, key=lambda x: -x["supplyApyWithRewards"])[:5]:
            for b in sorted(all_borrow, key=lambda x: x["effectiveBorrowApy"])[:5]:
                if s["chain"] == b["chain"]:
                    continue  # same chain, not cross-chain
                gross_spread = s["supplyApyWithRewards"] - b["effectiveBorrowApy"]
                if gross_spread > 0.005:  # > 0.5% spread
                    opp = {
                        "asset": asset,
                        "supply_chain": s["chain"],
                        "supply_apy": s["supplyApyWithRewards"],
                        "supply_apy_raw": s["supplyApy"],
                        "supply_collateral": s["collateral"],
                        "supply_tvl": s["supplyUsd"],
                        "borrow_chain": b["chain"],
                        "borrow_apy": b["borrowApy"],
                        "effective_borrow": b["effectiveBorrowApy"],
                        "borrow_collateral": b["collateral"],
                        "borrow_tvl": b["borrowUsd"],
                        "gross_spread": gross_spread,
                        "rewards": s["rewardSymbols"],
                    }
                    opportunities.append(opp)

    # Sort by spread and print top opportunities
    opportunities.sort(key=lambda x: -x["gross_spread"])

    print(f"\n{'=' * 80}")
    print(f"TOP CROSS-CHAIN ARBITRAGE OPPORTUNITIES (Morpho-to-Morpho)")
    print(f"Strategy: Borrow on Chain A → Bridge → Supply on Chain B")
    print(f"{'=' * 80}")

    seen = set()
    rank = 0
    for opp in opportunities:
        # Deduplicate similar opportunities
        key = (opp["asset"], opp["supply_chain"], opp["borrow_chain"])
        if key in seen:
            continue
        seen.add(key)
        rank += 1
        if rank > 30:
            break

        reward_note = f" +rewards({','.join(opp['rewards'])})" if opp["rewards"] else ""
        print(f"\n  #{rank:2d} | {opp['asset']:8s} | Spread: {opp['gross_spread']*100:5.2f}%")
        print(f"       Supply: {opp['supply_apy']*100:6.2f}%{reward_note} on {opp['supply_chain']} (coll: {opp['supply_collateral']}, TVL: ${opp['supply_tvl']/1e6:.1f}M)")
        print(f"       Borrow: {opp['borrow_apy']*100:6.2f}% (eff: {opp['effective_borrow']*100:.2f}%) on {opp['borrow_chain']} (coll: {opp['borrow_collateral']}, TVL: ${opp['borrow_tvl']/1e6:.1f}M)")

    # Summary stats
    if opportunities:
        print(f"\n{'=' * 80}")
        print(f"SUMMARY")
        print(f"{'=' * 80}")
        print(f"  Total opportunities (>0.5% spread): {len(seen)}")
        spreads = [opp["gross_spread"] for opp in opportunities]
        print(f"  Best spread: {max(spreads)*100:.2f}%")
        print(f"  Median spread: {sorted(spreads)[len(spreads)//2]*100:.2f}%")

        # Chain frequency
        chain_freq = defaultdict(int)
        for opp in opportunities:
            chain_freq[opp["supply_chain"]] += 1
            chain_freq[opp["borrow_chain"]] += 1
        print(f"  Most active chains: {', '.join(f'{c}({n})' for c, n in sorted(chain_freq.items(), key=lambda x: -x[1])[:6])}")

if __name__ == "__main__":
    main()
