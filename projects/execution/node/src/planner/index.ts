/**
 * Citadel Planner
 * Takes an opportunity + portfolio state and builds an execution plan
 * 
 * This is the brain: decides what actions to take and in what order.
 * Currently supports Morpho supply/borrow rebalancing across chains.
 */

import { type Address } from "viem";
import { SMART_ACCOUNT, MORPHO_BLUE } from "../config/index.js";
import type {
  CrossChainOpportunity,
  ExecutionPlan,
  ExecutionAction,
  PortfolioState,
} from "../types/index.js";
import {
  buildApprove,
  buildSupply,
  buildBorrow,
  buildSupplyCollateral,
  buildWithdraw,
  buildRepay,
  buildWithdrawCollateral,
  type MarketParams,
} from "../adapters/morpho.js";
import {
  getAcrossQuote,
  buildBridgeActions,
  estimateBridgeTime,
} from "../adapters/across.js";

/**
 * Build an execution plan for entering a cross-chain yield position
 * 
 * Strategy: 
 * 1. On borrow chain: supply collateral → borrow loan asset
 * 2. Bridge loan asset to supply chain
 * 3. On supply chain: supply loan asset to earn yield
 */
export async function planEntry(
  opportunity: CrossChainOpportunity,
  amount: bigint, // amount of loan asset to deploy
  collateralAmount: bigint, // amount of collateral to post
  borrowMarketParams: MarketParams,
  supplyMarketParams: MarketParams,
): Promise<ExecutionPlan> {
  const id = `entry-${opportunity.asset}-${Date.now()}`;
  const actions: ExecutionAction[] = [];
  const borrowChainId = opportunity.borrowMarket.chainId;
  const supplyChainId = opportunity.supplyMarket.chainId;

  // ── Phase 1: Borrow chain ──
  // 1a. Approve collateral to Morpho
  const approveCollateral = buildApprove(
    borrowMarketParams.collateralToken,
    MORPHO_BLUE[borrowChainId],
    collateralAmount,
    borrowChainId,
    opportunity.borrowMarket.collateralAsset,
  );
  actions.push({
    chainId: borrowChainId,
    ...approveCollateral,
  });

  // 1b. Supply collateral
  const supplyCollateral = buildSupplyCollateral(
    borrowMarketParams,
    collateralAmount,
    SMART_ACCOUNT,
    borrowChainId,
    opportunity.borrowMarket.collateralAsset,
  );
  actions.push({
    chainId: borrowChainId,
    ...supplyCollateral,
  });

  // 1c. Borrow loan asset
  const borrow = buildBorrow(
    borrowMarketParams,
    amount,
    SMART_ACCOUNT,
    SMART_ACCOUNT,
    borrowChainId,
    opportunity.asset,
  );
  actions.push({
    chainId: borrowChainId,
    ...borrow,
  });

  // ── Phase 2: Bridge ──
  // Get quote from Across
  let bridgeFee = 0;
  try {
    const quote = await getAcrossQuote({
      inputToken: borrowMarketParams.loanToken,
      outputToken: supplyMarketParams.loanToken,
      originChainId: borrowChainId,
      destinationChainId: supplyChainId,
      amount,
    });

    bridgeFee = Number(quote.fee);

    const bridgeActions = buildBridgeActions({
      depositor: SMART_ACCOUNT,
      recipient: SMART_ACCOUNT,
      inputToken: borrowMarketParams.loanToken,
      outputToken: supplyMarketParams.loanToken,
      originChainId: borrowChainId,
      destinationChainId: supplyChainId,
      quote,
      tokenSymbol: opportunity.asset,
    });

    for (const ba of bridgeActions) {
      actions.push({
        chainId: borrowChainId,
        ...ba,
      });
    }
  } catch (err: any) {
    console.warn(`Bridge quote failed: ${err.message}. Plan will be incomplete.`);
  }

  // ── Phase 3: Supply chain ──
  // 3a. Approve loan asset to Morpho
  const approveSupply = buildApprove(
    supplyMarketParams.loanToken,
    MORPHO_BLUE[supplyChainId],
    amount, // Will be adjusted with runtime injection in production
    supplyChainId,
    opportunity.asset,
  );
  actions.push({
    chainId: supplyChainId,
    ...approveSupply,
  });

  // 3b. Supply loan asset
  const supply = buildSupply(
    supplyMarketParams,
    amount, // Will use runtimeERC20BalanceOf in production
    SMART_ACCOUNT,
    supplyChainId,
    opportunity.asset,
  );
  actions.push({
    chainId: supplyChainId,
    ...supply,
  });

  // Estimate costs
  const estimatedGasCost = supplyChainId === 1 ? 50 : 5; // rough USD estimates
  const bridgeTimeSec = estimateBridgeTime(borrowChainId, supplyChainId);

  return {
    id,
    timestamp: Date.now(),
    opportunity,
    actions,
    estimatedGasCost,
    estimatedBridgeCost: bridgeFee / 1e6, // assuming 6 decimals for stablecoins
    estimatedNetBenefit:
      (Number(amount) / 1e6) * opportunity.grossSpread -
      estimatedGasCost -
      bridgeFee / 1e6,
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };
}

/**
 * Build an execution plan for exiting a cross-chain position (reverse flow)
 */
export async function planExit(
  opportunity: CrossChainOpportunity,
  supplyShares: bigint, // shares to withdraw
  borrowShares: bigint, // shares to repay
  supplyMarketParams: MarketParams,
  borrowMarketParams: MarketParams,
): Promise<ExecutionPlan> {
  const id = `exit-${opportunity.asset}-${Date.now()}`;
  const actions: ExecutionAction[] = [];
  const borrowChainId = opportunity.borrowMarket.chainId;
  const supplyChainId = opportunity.supplyMarket.chainId;

  // ── Phase 1: Withdraw from supply chain ──
  const withdraw = buildWithdraw(
    supplyMarketParams,
    0n, // withdraw all (by shares)
    supplyShares,
    SMART_ACCOUNT,
    SMART_ACCOUNT,
    supplyChainId,
    opportunity.asset,
  );
  actions.push({ chainId: supplyChainId, ...withdraw });

  // ── Phase 2: Bridge back ──
  // Quote will be fetched at execution time since we don't know exact amount yet

  // ── Phase 3: Repay on borrow chain ──
  const approveRepay = buildApprove(
    borrowMarketParams.loanToken,
    MORPHO_BLUE[borrowChainId],
    0n, // Will use runtime balance
    borrowChainId,
    opportunity.asset,
  );
  actions.push({ chainId: borrowChainId, ...approveRepay });

  const repay = buildRepay(
    borrowMarketParams,
    0n, // repay all (by shares)
    borrowShares,
    SMART_ACCOUNT,
    borrowChainId,
    opportunity.asset,
  );
  actions.push({ chainId: borrowChainId, ...repay });

  // Withdraw collateral
  const withdrawColl = buildWithdrawCollateral(
    borrowMarketParams,
    0n, // withdraw all — will need actual amount
    SMART_ACCOUNT,
    SMART_ACCOUNT,
    borrowChainId,
    opportunity.borrowMarket.collateralAsset,
  );
  actions.push({ chainId: borrowChainId, ...withdrawColl });

  return {
    id,
    timestamp: Date.now(),
    opportunity,
    actions,
    estimatedGasCost: supplyChainId === 1 ? 50 : 5,
    estimatedBridgeCost: 0, // estimated at execution time
    estimatedNetBenefit: 0, // exit is cost, not benefit
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
}

/**
 * Log an execution plan (paper trade mode)
 */
export function logPlan(plan: ExecutionPlan, mode: "paper" | "live" = "paper") {
  const prefix = mode === "paper" ? "📝 [PAPER]" : "🔴 [LIVE]";

  console.log(`\n${prefix} Execution Plan: ${plan.id}`);
  console.log(
    `  Opportunity: ${plan.opportunity.asset} | ${(plan.opportunity.grossSpread * 100).toFixed(2)}% spread`
  );
  console.log(
    `  Supply: ${plan.opportunity.supplyMarket.chain} | Borrow: ${plan.opportunity.borrowMarket.chain}`
  );
  console.log(`  Actions (${plan.actions.length}):`);

  let currentChain = 0;
  for (const action of plan.actions) {
    if (action.chainId !== currentChain) {
      currentChain = action.chainId;
      console.log(`    ── Chain ${currentChain} ──`);
    }
    console.log(`    → ${action.description}`);
    console.log(`      target: ${action.target}`);
    console.log(`      calldata: ${action.calldata.slice(0, 20)}...`);
  }

  console.log(
    `  Estimated gas: $${plan.estimatedGasCost.toFixed(2)} | Bridge: $${plan.estimatedBridgeCost.toFixed(2)}`
  );
  console.log(`  Estimated net benefit: $${plan.estimatedNetBenefit.toFixed(2)}`);
  console.log(
    `  Deadline: ${new Date(plan.deadline * 1000).toISOString()}`
  );
}
