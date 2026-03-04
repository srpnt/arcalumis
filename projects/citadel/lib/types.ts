// ============================================================
// The Citadel — TypeScript Interfaces
// ============================================================

// --- Morpho Types ---

export interface MorphoMarket {
  uniqueKey: string;
  chainId: number;
  chain: string;
  loanAsset: string;
  collateralAsset: string;
  pair: string;
  supplyUsd: number;
  borrowUsd: number;
  liquidityUsd: number;
  utilization: number;
  supplyApy: number;
  borrowApy: number;
  fee: number;
  lltv: number;
  rewards: MorphoReward[];
}

export interface MorphoReward {
  asset: string;
  supplyApr: number;
  borrowApr: number;
}

export interface MorphoVault {
  address: string;
  name: string;
  symbol: string;
  chainId: number;
  chain: string;
  underlyingAsset: string;
  totalAssetsUsd: number;
  apy: number;
  netApy: number;
  fee: number;
  description: string;
  numMarkets: number;
  curator?: string;
}

export interface MorphoData {
  timestamp: number;
  markets: MorphoMarket[];
  vaults: MorphoVault[];
}

// --- Cross-chain Differentials ---

export interface ChainRate {
  asset: string;
  ethBestApy: number;
  ethAvgApy: number;
  ethTvl: number;
  ethCount: number;
  baseBestApy: number;
  baseAvgApy: number;
  baseTvl: number;
  baseCount: number;
  spread: number;
  absSpread: number;
}

// --- Signals ---

export type SignalUrgency = "critical" | "notable" | "info";

export interface Signal {
  id: string;
  urgency: SignalUrgency;
  title: string;
  body: string;
  source: string;
  date: string;
}

// --- Arkham Types ---

export interface ArkhamEntity {
  name: string;
  type: string;
  labels: string[];
  website?: string;
  twitter?: string;
  address: string;
}

export interface ArkhamBalance {
  chain: string;
  token: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
}

export interface ArkhamTransfer {
  time: string;
  from: string;
  to: string;
  token: string;
  valueUsd: number;
  txHash: string;
}

// --- Cross-Chain Arbitrage ---

export interface ArbitrageOpportunity {
  asset: string;
  grossSpread: number;
  supplyChain: string;
  supplyChainId: number;
  supplyApy: number;
  supplyApyRaw: number;
  supplyCollateral: string;
  supplyTvl: number;
  supplyMarketId: string;
  borrowChain: string;
  borrowChainId: number;
  borrowApy: number;
  effectiveBorrowApy: number;
  borrowCollateral: string;
  borrowTvl: number;
  borrowMarketId: string;
  rewardTokens: string[];
}

export interface ChainSummary {
  chain: string;
  chainId: number;
  totalSupplyTvl: number;
  totalBorrowTvl: number;
  marketCount: number;
  bestSupplyApy: number;
  lowestBorrowApy: number;
  assets: string[];
}

export interface AssetChainData {
  chain: string;
  chainId: number;
  bestSupplyApy: number;
  bestSupplyApyRaw: number;
  lowestBorrowApy: number;
  effectiveBorrowApy: number;
  supplyTvl: number;
  borrowTvl: number;
  marketCount: number;
  rewardTokens: string[];
  bestSupplyMarketId: string;
  lowestBorrowMarketId: string;
}

export interface ArbitrageData {
  timestamp: number;
  totalOpportunities: number;
  bestSpread: number;
  chainsMonitored: number;
  crossChainTvl: number;
  opportunities: ArbitrageOpportunity[];
  chainSummaries: ChainSummary[];
  assetBreakdowns: Record<string, AssetChainData[]>;
}

// --- Shared ---

export type ChainFilter = "all" | "ethereum" | "base";

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
};

/** Morpho frontend network slugs by chain ID */
export const MORPHO_NETWORK_SLUGS: Record<number, string> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
  130: "unichain",
  480: "worldchain",
  57073: "ink",
  999: "hyperevm",
  747474: "katana",
  143: "monad",
  25: "cronos",
  988: "stable",
  98866: "plume",
};

/** Build a Morpho frontend market URL */
export function getMorphoMarketUrl(uniqueKey: string, chainId: number): string | null {
  const slug = MORPHO_NETWORK_SLUGS[chainId];
  if (!slug || !uniqueKey) return null;
  return `https://app.morpho.org/market?id=${uniqueKey}&network=${slug}`;
}
