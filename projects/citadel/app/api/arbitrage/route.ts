// ============================================================
// Cross-Chain Arbitrage API — Morpho markets across all chains
// ============================================================

import { NextResponse } from "next/server";
import type {
  ArbitrageOpportunity,
  ChainSummary,
  AssetChainData,
  ArbitrageData,
} from "@/lib/types";

const MORPHO_API = process.env.MORPHO_API_URL || "https://api.morpho.org/graphql";

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
`;

// Chain ID → human-readable name
const CHAIN_ID_NAME: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  56: "BNB Chain",
  100: "Gnosis",
  130: "Unichain",
  137: "Polygon",
  146: "Sonic",
  480: "Worldchain",
  690: "Redstone",
  1135: "Lisk",
  5000: "Mantle",
  8453: "Base",
  42161: "Arbitrum",
  42220: "Celo",
  43114: "Avalanche",
  80084: "Berachain",
  81457: "Blast",
  534352: "Scroll",
  59144: "Linea",
};

function sf(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

interface RawReward {
  asset?: { symbol?: string };
  supplyApr?: number | string | null;
  borrowApr?: number | string | null;
}

interface RawMarket {
  uniqueKey?: string;
  lltv?: number | string | null;
  loanAsset?: { symbol?: string; address?: string };
  collateralAsset?: { symbol?: string; address?: string };
  morphoBlue?: { chain?: { id?: number; network?: string } };
  state?: {
    supplyAssetsUsd?: number | string | null;
    borrowAssetsUsd?: number | string | null;
    supplyApy?: number | string | null;
    borrowApy?: number | string | null;
    fee?: number | string | null;
    utilization?: number | string | null;
    rewards?: RawReward[];
  };
}

async function fetchMarketsBatch(first: number, skip: number): Promise<RawMarket[]> {
  const res = await fetch(MORPHO_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: MARKETS_QUERY,
      variables: { first, skip },
    }),
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  if (json.errors) return [];
  return json.data?.markets?.items || [];
}

interface ProcessedMarket {
  chain: string;
  chainId: number;
  collateral: string;
  supplyUsd: number;
  borrowUsd: number;
  supplyApy: number;
  borrowApy: number;
  supplyApyWithRewards: number;
  effectiveBorrowApy: number;
  rewardSymbols: string[];
}

export async function GET() {
  try {
    // Fetch all markets in batches
    const allRaw: RawMarket[] = [];
    for (let skip = 0; skip < 2000; skip += 500) {
      const batch = await fetchMarketsBatch(500, skip);
      if (!batch.length) break;
      allRaw.push(...batch);
    }

    // Process and group by loan asset
    const byAsset = new Map<string, ProcessedMarket[]>();
    const allChainIds = new Set<number>();

    for (const m of allRaw) {
      const loan = m.loanAsset || {};
      const coll = m.collateralAsset || {};
      const state = m.state || {};
      const chain = m.morphoBlue?.chain || {};

      const supplyUsd = sf(state.supplyAssetsUsd);
      const borrowUsd = sf(state.borrowAssetsUsd);
      const supplyApy = sf(state.supplyApy);
      const borrowApy = sf(state.borrowApy);

      const rewards = state.rewards || [];
      const totalSupplyReward = rewards.reduce((s, r) => s + sf(r.supplyApr), 0);
      const totalBorrowReward = rewards.reduce((s, r) => s + sf(r.borrowApr), 0);

      // Filter spam and tiny markets
      if (supplyUsd < 50_000) continue;
      if (supplyApy > 2.0 && totalSupplyReward === 0) continue;

      const chainId = chain.id || 0;
      const chainName = CHAIN_ID_NAME[chainId] || chain.network || `Chain ${chainId}`;
      allChainIds.add(chainId);

      const symbol = loan.symbol || "?";
      const existing = byAsset.get(symbol) || [];
      existing.push({
        chain: chainName,
        chainId,
        collateral: coll.symbol || "—",
        supplyUsd,
        borrowUsd,
        supplyApy,
        borrowApy,
        supplyApyWithRewards: supplyApy + totalSupplyReward,
        effectiveBorrowApy: borrowApy - totalBorrowReward,
        rewardSymbols: rewards
          .filter((r) => sf(r.supplyApr) > 0 || sf(r.borrowApr) > 0)
          .map((r) => r.asset?.symbol || "?"),
      });
      byAsset.set(symbol, existing);
    }

    // Build chain summaries
    const chainAgg = new Map<
      number,
      {
        chain: string;
        supplyTvl: number;
        borrowTvl: number;
        count: number;
        bestSupply: number;
        lowestBorrow: number;
        assets: Set<string>;
      }
    >();

    for (const [asset, markets] of byAsset) {
      for (const m of markets) {
        const existing = chainAgg.get(m.chainId) || {
          chain: m.chain,
          supplyTvl: 0,
          borrowTvl: 0,
          count: 0,
          bestSupply: 0,
          lowestBorrow: Infinity,
          assets: new Set<string>(),
        };
        existing.supplyTvl += m.supplyUsd;
        existing.borrowTvl += m.borrowUsd;
        existing.count++;
        existing.bestSupply = Math.max(existing.bestSupply, m.supplyApyWithRewards);
        if (m.borrowApy > 0) {
          existing.lowestBorrow = Math.min(existing.lowestBorrow, m.borrowApy);
        }
        existing.assets.add(asset);
        chainAgg.set(m.chainId, existing);
      }
    }

    const chainSummaries: ChainSummary[] = [...chainAgg.entries()]
      .map(([chainId, d]) => ({
        chain: d.chain,
        chainId,
        totalSupplyTvl: d.supplyTvl,
        totalBorrowTvl: d.borrowTvl,
        marketCount: d.count,
        bestSupplyApy: d.bestSupply,
        lowestBorrowApy: d.lowestBorrow === Infinity ? 0 : d.lowestBorrow,
        assets: [...d.assets],
      }))
      .sort((a, b) => b.totalSupplyTvl - a.totalSupplyTvl);

    // Find cross-chain assets and build opportunities
    const opportunities: ArbitrageOpportunity[] = [];
    const assetBreakdowns: Record<string, AssetChainData[]> = {};

    for (const [asset, markets] of byAsset) {
      const chains = new Set(markets.map((m) => m.chain));
      if (chains.size < 2) continue;

      // Build per-chain summary for this asset
      const perChain = new Map<
        string,
        {
          chainId: number;
          bestSupply: number;
          bestSupplyRaw: number;
          lowestBorrow: number;
          effectiveBorrow: number;
          supplyTvl: number;
          borrowTvl: number;
          count: number;
          rewards: Set<string>;
        }
      >();

      for (const m of markets) {
        const existing = perChain.get(m.chain) || {
          chainId: m.chainId,
          bestSupply: 0,
          bestSupplyRaw: 0,
          lowestBorrow: Infinity,
          effectiveBorrow: Infinity,
          supplyTvl: 0,
          borrowTvl: 0,
          count: 0,
          rewards: new Set<string>(),
        };
        existing.bestSupply = Math.max(existing.bestSupply, m.supplyApyWithRewards);
        existing.bestSupplyRaw = Math.max(existing.bestSupplyRaw, m.supplyApy);
        if (m.borrowApy > 0) {
          existing.lowestBorrow = Math.min(existing.lowestBorrow, m.borrowApy);
          existing.effectiveBorrow = Math.min(existing.effectiveBorrow, m.effectiveBorrowApy);
        }
        existing.supplyTvl += m.supplyUsd;
        existing.borrowTvl += m.borrowUsd;
        existing.count++;
        m.rewardSymbols.forEach((r) => existing.rewards.add(r));
        perChain.set(m.chain, existing);
      }

      // Store asset breakdown
      assetBreakdowns[asset] = [...perChain.entries()].map(([chain, d]) => ({
        chain,
        chainId: d.chainId,
        bestSupplyApy: d.bestSupply,
        bestSupplyApyRaw: d.bestSupplyRaw,
        lowestBorrowApy: d.lowestBorrow === Infinity ? 0 : d.lowestBorrow,
        effectiveBorrowApy: d.effectiveBorrow === Infinity ? 0 : d.effectiveBorrow,
        supplyTvl: d.supplyTvl,
        borrowTvl: d.borrowTvl,
        marketCount: d.count,
        rewardTokens: [...d.rewards],
      }));

      // Generate cross-chain opportunities
      const allSupply = markets
        .filter((m) => m.supplyApyWithRewards > 0 && m.supplyUsd > 100_000)
        .sort((a, b) => b.supplyApyWithRewards - a.supplyApyWithRewards)
        .slice(0, 5);

      const allBorrow = markets
        .filter((m) => m.borrowApy > 0 && m.borrowUsd > 50_000)
        .sort((a, b) => a.effectiveBorrowApy - b.effectiveBorrowApy)
        .slice(0, 5);

      for (const s of allSupply) {
        for (const b of allBorrow) {
          if (s.chain === b.chain) continue;
          const grossSpread = s.supplyApyWithRewards - b.effectiveBorrowApy;
          if (grossSpread > 0.005) {
            opportunities.push({
              asset,
              grossSpread,
              supplyChain: s.chain,
              supplyChainId: s.chainId,
              supplyApy: s.supplyApyWithRewards,
              supplyApyRaw: s.supplyApy,
              supplyCollateral: s.collateral,
              supplyTvl: s.supplyUsd,
              borrowChain: b.chain,
              borrowChainId: b.chainId,
              borrowApy: b.borrowApy,
              effectiveBorrowApy: b.effectiveBorrowApy,
              borrowCollateral: b.collateral,
              borrowTvl: b.borrowUsd,
              rewardTokens: s.rewardSymbols,
            });
          }
        }
      }
    }

    // Deduplicate: keep best spread per (asset, supplyChain, borrowChain)
    const deduped = new Map<string, ArbitrageOpportunity>();
    for (const opp of opportunities) {
      const key = `${opp.asset}-${opp.supplyChain}-${opp.borrowChain}`;
      const existing = deduped.get(key);
      if (!existing || opp.grossSpread > existing.grossSpread) {
        deduped.set(key, opp);
      }
    }

    const sorted = [...deduped.values()].sort((a, b) => b.grossSpread - a.grossSpread);

    const totalTvl = chainSummaries.reduce((s, c) => s + c.totalSupplyTvl, 0);

    const result: ArbitrageData = {
      timestamp: Date.now(),
      totalOpportunities: sorted.filter((o) => o.grossSpread > 0.005).length,
      bestSpread: sorted.length ? sorted[0].grossSpread : 0,
      chainsMonitored: allChainIds.size,
      crossChainTvl: totalTvl,
      opportunities: sorted.slice(0, 100),
      chainSummaries,
      assetBreakdowns,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
