// ============================================================
// Collateral Exposure API — aggregates Morpho market data
// by collateral asset with risk tier classification
// ============================================================

import { NextResponse } from "next/server";

const MORPHO_API = "https://api.morpho.org/graphql";

const MARKETS_QUERY = `
query CollateralExposure {
  markets(
    first: 500
    where: { whitelisted: true }
    orderBy: SupplyAssetsUsd
    orderDirection: Desc
  ) {
    items {
      uniqueKey
      loanAsset { address symbol priceUsd }
      collateralAsset { address symbol priceUsd }
      state {
        supplyAssetsUsd
        borrowAssetsUsd
        utilization
      }
      oracleAddress
      lltv
      morphoBlue { chain { id } }
    }
  }
}
`;

// Fallback query if whitelisted doesn't work
const MARKETS_QUERY_LISTED = MARKETS_QUERY.replace(
  "whitelisted: true",
  "listed: true"
);

// --- Risk Tier Classification ---

const TIER_1_SYMBOLS = new Set([
  "WETH", "wETH", "ETH",
  "WBTC", "wBTC", "BTC",
  "stETH", "wstETH",
  "cbETH", "rETH", "cbBTC",
]);

const TIER_2_SYMBOLS = new Set([
  "USDC", "USDT", "DAI", "FRAX", "USDS", "sDAI", "PYUSD",
]);

const TIER_3_SYMBOLS = new Set([
  "ezETH", "weETH", "rsETH", "USDe", "sUSDe",
  "osETH", "mETH", "swETH", "USDA",
  "eETH", "pufETH", "ETHx", "OETH",
  "woETH", "sFRAX", "sfrxETH", "frxETH",
  "apxETH", "Re7WETH", "PT-weETH",
]);

function classifyTier(symbol: string): { tier: number; label: string; emoji: string } {
  if (TIER_1_SYMBOLS.has(symbol)) return { tier: 1, label: "Blue Chip", emoji: "🟢" };
  if (TIER_2_SYMBOLS.has(symbol)) return { tier: 2, label: "Established", emoji: "🔵" };
  if (TIER_3_SYMBOLS.has(symbol)) return { tier: 3, label: "Emerging", emoji: "🟡" };
  return { tier: 4, label: "Exotic", emoji: "🔴" };
}

function chainName(id: number): string {
  if (id === 1) return "Ethereum";
  if (id === 8453) return "Base";
  return `Chain ${id}`;
}

interface RawMarketItem {
  uniqueKey: string;
  loanAsset: { address: string; symbol: string; priceUsd: number | null } | null;
  collateralAsset: { address: string; symbol: string; priceUsd: number | null } | null;
  state: { supplyAssetsUsd: number | null; borrowAssetsUsd: number | null; utilization: number | null } | null;
  oracleAddress: string | null;
  lltv: string | null;
  morphoBlue: { chain: { id: number } } | null;
}

export interface ExposureMarket {
  uniqueKey: string;
  loanAsset: string;
  loanAssetAddress: string;
  lltv: number;
  supplyUsd: number;
  borrowUsd: number;
  utilization: number;
  oracleAddress: string;
  chainId: number;
  chain: string;
}

export interface CollateralExposure {
  symbol: string;
  address: string;
  priceUsd: number;
  tier: number;
  tierLabel: string;
  tierEmoji: string;
  totalExposureUsd: number;
  totalBorrowUsd: number;
  marketCount: number;
  chains: string[];
  chainIds: number[];
  markets: ExposureMarket[];
}

export interface ExposureResponse {
  timestamp: number;
  totalAssetsTracked: number;
  totalExposureUsd: number;
  tier4ExposureUsd: number;
  highestConcentration: { symbol: string; pct: number };
  assets: CollateralExposure[];
}

async function fetchMarkets(): Promise<RawMarketItem[]> {
  // Try whitelisted first, fall back to listed
  for (const query of [MARKETS_QUERY, MARKETS_QUERY_LISTED]) {
    try {
      const res = await fetch(MORPHO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query }),
        next: { revalidate: 300 }, // cache 5 min
      });

      const json = await res.json();
      if (json.errors) {
        console.warn("GraphQL errors, trying fallback:", json.errors[0]?.message);
        continue;
      }

      return json.data?.markets?.items || [];
    } catch (e) {
      console.warn("Fetch error, trying fallback:", e);
      continue;
    }
  }
  return [];
}

function sf(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export async function GET() {
  try {
    const items = await fetchMarkets();

    // Group by collateral asset (symbol + address as key for uniqueness)
    const assetMap = new Map<string, CollateralExposure>();

    for (const item of items) {
      const collateral = item.collateralAsset;
      if (!collateral || !collateral.symbol) continue;

      const sym = collateral.symbol;
      const addr = collateral.address || "";
      // Use symbol as primary key (aggregate across chains)
      const key = sym;

      const chainId = item.morphoBlue?.chain?.id ?? 1;
      const chain = chainName(chainId);
      const state = item.state;
      const supplyUsd = sf(state?.supplyAssetsUsd);
      const borrowUsd = sf(state?.borrowAssetsUsd);
      const lltv = item.lltv ? Number(item.lltv) / 1e18 : 0;
      const utilization = sf(state?.utilization);

      const market: ExposureMarket = {
        uniqueKey: item.uniqueKey,
        loanAsset: item.loanAsset?.symbol || "?",
        loanAssetAddress: item.loanAsset?.address || "",
        lltv,
        supplyUsd,
        borrowUsd,
        utilization,
        oracleAddress: item.oracleAddress || "",
        chainId,
        chain,
      };

      if (assetMap.has(key)) {
        const existing = assetMap.get(key)!;
        existing.totalExposureUsd += supplyUsd;
        existing.totalBorrowUsd += borrowUsd;
        existing.marketCount += 1;
        existing.markets.push(market);
        if (!existing.chainIds.includes(chainId)) {
          existing.chainIds.push(chainId);
          existing.chains.push(chain);
        }
        // Update price if we have a newer/valid one
        if (sf(collateral.priceUsd) > 0) {
          existing.priceUsd = sf(collateral.priceUsd);
        }
      } else {
        const tierInfo = classifyTier(sym);
        assetMap.set(key, {
          symbol: sym,
          address: addr,
          priceUsd: sf(collateral.priceUsd),
          tier: tierInfo.tier,
          tierLabel: tierInfo.label,
          tierEmoji: tierInfo.emoji,
          totalExposureUsd: supplyUsd,
          totalBorrowUsd: borrowUsd,
          marketCount: 1,
          chains: [chain],
          chainIds: [chainId],
          markets: [market],
        });
      }
    }

    const assets = Array.from(assetMap.values()).sort(
      (a, b) => b.totalExposureUsd - a.totalExposureUsd
    );

    const totalExposure = assets.reduce((s, a) => s + a.totalExposureUsd, 0);
    const tier4Exposure = assets
      .filter((a) => a.tier === 4)
      .reduce((s, a) => s + a.totalExposureUsd, 0);

    // Highest concentration
    let highestConc = { symbol: "—", pct: 0 };
    if (totalExposure > 0 && assets.length > 0) {
      const top = assets[0];
      highestConc = {
        symbol: top.symbol,
        pct: top.totalExposureUsd / totalExposure,
      };
    }

    const response: ExposureResponse = {
      timestamp: Date.now(),
      totalAssetsTracked: assets.length,
      totalExposureUsd: totalExposure,
      tier4ExposureUsd: tier4Exposure,
      highestConcentration: highestConc,
      assets,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Exposure API error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
