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

// --- Shared ---

export type ChainFilter = "all" | "ethereum" | "base";

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
};
