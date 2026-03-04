// ============================================================
// Morpho GraphQL Client
// ============================================================

import { MorphoMarket, MorphoVault, CHAIN_NAMES } from "./types";

const MORPHO_API = process.env.MORPHO_API_URL || "https://api.morpho.org/graphql";

const VAULTS_QUERY = `
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
`;

const MARKETS_QUERY = `
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
`;

function sf(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

export async function fetchVaults(
  chains: number[] = [1, 8453],
  topN: number = 50
): Promise<MorphoVault[]> {
  const res = await fetch(MORPHO_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: VAULTS_QUERY, variables: { first: topN, chains } }),
  });

  if (!res.ok) throw new Error(`Morpho API HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));

  const items = json.data?.vaults?.items || [];
  const results: MorphoVault[] = [];

  for (const v of items) {
    const state = v.state || {};
    const chain = v.chain || {};
    const asset = v.asset || {};
    const meta = v.metadata || {};

    const apy = sf(state.apy);
    const netApy = sf(state.netApy);

    // Filter spam (>100% APY)
    if (apy > 1.0 || netApy > 1.0) continue;

    results.push({
      address: v.address || "",
      name: v.name || "",
      symbol: v.symbol || "",
      chainId: chain.id,
      chain: CHAIN_NAMES[chain.id] || chain.network || "?",
      underlyingAsset: asset.symbol || "?",
      totalAssetsUsd: sf(state.totalAssetsUsd),
      apy,
      netApy,
      fee: sf(state.fee),
      description: (meta.description || "").slice(0, 200),
      numMarkets: (state.allocation || []).length,
    });
  }

  return results;
}

export async function fetchMarkets(
  chains: number[] = [1, 8453],
  topN: number = 50
): Promise<MorphoMarket[]> {
  const res = await fetch(MORPHO_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: MARKETS_QUERY, variables: { first: topN, chains } }),
  });

  if (!res.ok) throw new Error(`Morpho API HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));

  const items = json.data?.markets?.items || [];
  const results: MorphoMarket[] = [];

  for (const m of items) {
    const state = m.state || {};
    const loan = m.loanAsset || {};
    const coll = m.collateralAsset || {};
    const chainObj = m.morphoBlue?.chain || {};
    const chainId = chainObj.id;

    const supplyApy = sf(state.supplyApy);
    const borrowApy = sf(state.borrowApy);

    // Filter spam
    if (supplyApy > 1.0 || borrowApy > 1.0) continue;

    const collSymbol = coll.symbol || "—";
    const loanSymbol = loan.symbol || "?";

    const rewards = (state.rewards || []).map((r: Record<string, unknown>) => ({
      asset: (r.asset as Record<string, string>)?.symbol || "?",
      supplyApr: sf(r.supplyApr),
      borrowApr: sf(r.borrowApr),
    }));

    results.push({
      uniqueKey: m.uniqueKey || "",
      chainId,
      chain: CHAIN_NAMES[chainId] || String(chainId || "?"),
      loanAsset: loanSymbol,
      collateralAsset: collSymbol,
      pair: `${collSymbol}/${loanSymbol}`,
      supplyUsd: sf(state.supplyAssetsUsd),
      borrowUsd: sf(state.borrowAssetsUsd),
      liquidityUsd: sf(state.liquidityAssetsUsd),
      utilization: sf(state.utilization),
      supplyApy,
      borrowApy,
      fee: sf(state.fee),
      lltv: sf(m.lltv),
      rewards,
    });
  }

  return results;
}
