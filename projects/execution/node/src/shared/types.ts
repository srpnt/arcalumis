/**
 * Citadel Node Types
 */

import type { Address, Hex } from "viem";

// ============================================================
// Market & Rate Types
// ============================================================

export interface MorphoMarketRate {
  uniqueKey: string;
  chainId: number;
  chain: string;
  loanAsset: string;
  loanAssetAddress: Address;
  collateralAsset: string;
  collateralAssetAddress: Address;
  supplyApy: number;
  borrowApy: number;
  supplyApyWithRewards: number;
  effectiveBorrowApy: number;
  supplyUsd: number;
  borrowUsd: number;
  liquidityUsd: number;
  utilization: number;
  lltv: number;
  rewardTokens: string[];
}

export interface CrossChainOpportunity {
  asset: string;
  grossSpread: number;
  organicSpread: number;
  rewardDependencyPct: number;

  supplyMarket: MorphoMarketRate;
  borrowMarket: MorphoMarketRate;
}

// ============================================================
// Portfolio State
// ============================================================

export interface TokenBalance {
  token: string;
  address: Address;
  balance: bigint;
  balanceUsd: number;
}

export interface ChainPortfolio {
  chainId: number;
  chain: string;
  ethBalance: bigint;
  ethBalanceUsd: number;
  tokenBalances: TokenBalance[];
  // Morpho positions
  morphoSupplies: MorphoPosition[];
  morphoBorrows: MorphoPosition[];
}

export interface MorphoPosition {
  marketId: string;
  chainId: number;
  asset: string;
  amount: bigint;
  amountUsd: number;
  apy: number;
  collateral?: string;
}

export interface PortfolioState {
  timestamp: number;
  smartAccount: Address;
  chains: Record<number, ChainPortfolio>;
  totalValueUsd: number;
}

// ============================================================
// Execution Plan
// ============================================================

export interface ExecutionAction {
  chainId: number;
  target: Address;
  calldata: `0x${string}`;
  value: bigint;
  description: string;
}

export interface ExecutionPlan {
  id: string;
  timestamp: number;
  opportunity: CrossChainOpportunity;
  actions: ExecutionAction[];
  estimatedGasCost: number;
  estimatedBridgeCost: number;
  estimatedNetBenefit: number;
  deadline: number; // unix timestamp
}

// ============================================================
// Plan Status (for file-based coordination)
// ============================================================

export type PlanStatus = "pending" | "executing" | "completed" | "failed";

export interface StoredPlan {
  plan: ExecutionPlan;
  status: PlanStatus;
  createdAt: number;
  updatedAt: number;
  executionResults?: ExecutionResult[];
  error?: string;
}

export interface ExecutionResult {
  chainId: number;
  txHash: Hex;
  success: boolean;
  gasUsed: bigint;
  error?: string;
  timestamp: number;
}

// ============================================================
// Monitor Types
// ============================================================

export interface MonitorStatus {
  timestamp: number;
  chains: Record<number, ChainMonitorStatus>;
  services: ServiceLiveness;
  alerts: MonitorAlert[];
}

export interface ChainMonitorStatus {
  chainId: number;
  chainName: string;
  eoaEthBalance: string; // formatted ETH
  eoaEthBalanceWei: string;
  entryPointDeposit: string; // formatted ETH
  entryPointDepositWei: string;
  smartAccountTokens: { symbol: string; balance: string; formatted: string }[];
  morphoPositions: {
    marketId: string;
    loanAsset: string;
    collateralAsset: string;
    supplyShares: string;
    borrowShares: string;
    collateral: string;
  }[];
}

export interface ServiceLiveness {
  watcher: { lastWrite: number | null; healthy: boolean };
  planner: { lastWrite: number | null; healthy: boolean };
  executor: { lastWrite: number | null; healthy: boolean };
  monitor: { lastWrite: number | null; healthy: boolean };
}

export interface MonitorAlert {
  level: "warning" | "critical";
  message: string;
  timestamp: number;
}

// ============================================================
// Node State (legacy, kept for compatibility)
// ============================================================

export type NodeMode = "paper" | "live";

export interface NodeState {
  mode: NodeMode;
  lastScan: number;
  opportunities: CrossChainOpportunity[];
  portfolio: PortfolioState | null;
  activePlans: ExecutionPlan[];
}
