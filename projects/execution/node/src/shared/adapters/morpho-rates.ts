/**
 * Morpho Rate Watcher
 * Fetches market rates across all chains and identifies cross-chain opportunities
 */

import type { MorphoMarketRate, CrossChainOpportunity } from "../types.js";

const MORPHO_API =
  process.env.MORPHO_API_URL || "https://api.morpho.org/graphql";

const MARKETS_QUERY = `
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
      creationTimestamp
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
        rewards {
          asset { symbol }
          supplyApr
          borrowApr
        }
      }
    }
  }
}
`;

function sf(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

async function fetchMarketsBatch(
  first: number,
  skip: number
): Promise<any[]> {
  const res = await fetch(MORPHO_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: MARKETS_QUERY,
      variables: { first, skip },
    }),
  });

  if (!res.ok) throw new Error(`Morpho API HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors)
    throw new Error(json.errors.map((e: any) => e.message).join("; "));
  return json.data?.markets?.items || [];
}

export async function fetchAllMarkets(): Promise<MorphoMarketRate[]> {
  const allRaw: any[] = [];
  for (let skip = 0; skip < 2000; skip += 500) {
    const batch = await fetchMarketsBatch(500, skip);
    if (!batch.length) break;
    allRaw.push(...batch);
  }

  const markets: MorphoMarketRate[] = [];

  for (const m of allRaw) {
    const loan = m.loanAsset || {};
    const coll = m.collateralAsset || {};
    const state = m.state || {};
    const chain = m.morphoBlue?.chain || {};
    const supplyUsd = sf(state.supplyAssetsUsd);
    const borrowUsd = sf(state.borrowAssetsUsd);
    const supplyApy = sf(state.supplyApy);
    const borrowApy = sf(state.borrowApy);

    if (supplyUsd < 50_000) continue;
    if (supplyApy > 2.0) continue; // spam filter

    const rewards = state.rewards || [];
    const totalSupplyReward = rewards.reduce(
      (s: number, r: any) => s + sf(r.supplyApr),
      0
    );
    const totalBorrowReward = rewards.reduce(
      (s: number, r: any) => s + sf(r.borrowApr),
      0
    );

    markets.push({
      uniqueKey: m.uniqueKey || "",
      chainId: chain.id || 0,
      chain: chain.network || "?",
      loanAsset: loan.symbol || "?",
      loanAssetAddress: loan.address || "0x",
      collateralAsset: coll.symbol || "—",
      collateralAssetAddress: coll.address || "0x",
      supplyApy,
      borrowApy,
      supplyApyWithRewards: supplyApy + totalSupplyReward,
      effectiveBorrowApy: borrowApy - totalBorrowReward,
      supplyUsd,
      borrowUsd,
      liquidityUsd: sf(state.liquidityAssetsUsd),
      utilization: sf(state.utilization),
      lltv: m.lltv ? sf(m.lltv) / 1e18 : 0,
      rewardTokens: rewards
        .filter(
          (r: any) => sf(r.supplyApr) > 0 || sf(r.borrowApr) > 0
        )
        .map((r: any) => r.asset?.symbol || "?"),
    });
  }

  return markets;
}

export function findOpportunities(
  markets: MorphoMarketRate[],
  opts: {
    minSpreadPct?: number;
    minSupplyTvl?: number;
    minBorrowTvl?: number;
    targetChainIds?: number[];
    positiveborrowOnly?: boolean;
  } = {}
): CrossChainOpportunity[] {
  const {
    minSpreadPct = 0.5,
    minSupplyTvl = 100_000,
    minBorrowTvl = 50_000,
    targetChainIds,
    positiveborrowOnly = false,
  } = opts;

  const minSpread = minSpreadPct / 100;

  // Group by loan asset
  const byAsset = new Map<string, MorphoMarketRate[]>();
  for (const m of markets) {
    if (targetChainIds && !targetChainIds.includes(m.chainId)) continue;
    const arr = byAsset.get(m.loanAsset) || [];
    arr.push(m);
    byAsset.set(m.loanAsset, arr);
  }

  const opportunities: CrossChainOpportunity[] = [];

  for (const [asset, assetMarkets] of byAsset) {
    // Need at least 2 chains
    const chains = new Set(assetMarkets.map((m) => m.chainId));
    if (chains.size < 2) continue;

    // Get top supply markets and lowest borrow markets
    const supplyMarkets = assetMarkets
      .filter((m) => m.supplyApyWithRewards > 0 && m.supplyUsd >= minSupplyTvl)
      .sort((a, b) => b.supplyApyWithRewards - a.supplyApyWithRewards)
      .slice(0, 5);

    const borrowMarkets = assetMarkets
      .filter((m) => m.borrowApy > 0 && m.borrowUsd >= minBorrowTvl)
      .sort((a, b) => a.effectiveBorrowApy - b.effectiveBorrowApy)
      .slice(0, 5);

    for (const supply of supplyMarkets) {
      for (const borrow of borrowMarkets) {
        if (supply.chainId === borrow.chainId) continue;
        if (positiveborrowOnly && borrow.effectiveBorrowApy < 0) continue;

        const grossSpread =
          supply.supplyApyWithRewards - borrow.effectiveBorrowApy;
        if (grossSpread < minSpread) continue;

        const organicSpread = supply.supplyApy - borrow.borrowApy;
        const rewardSpread = grossSpread - organicSpread;
        const rewardDep =
          grossSpread > 0
            ? Math.max(0, Math.min(1, rewardSpread / grossSpread))
            : 0;

        opportunities.push({
          asset,
          grossSpread,
          organicSpread,
          rewardDependencyPct: rewardDep,
          supplyMarket: supply,
          borrowMarket: borrow,
        });
      }
    }
  }

  // Deduplicate: best spread per (asset, supplyChain, borrowChain)
  const deduped = new Map<string, CrossChainOpportunity>();
  for (const opp of opportunities) {
    const key = `${opp.asset}-${opp.supplyMarket.chainId}-${opp.borrowMarket.chainId}`;
    const existing = deduped.get(key);
    if (!existing || opp.grossSpread > existing.grossSpread) {
      deduped.set(key, opp);
    }
  }

  return [...deduped.values()].sort((a, b) => b.grossSpread - a.grossSpread);
}
