/**
 * Planner Service
 * 
 * Reads opportunities and portfolio from data/, builds execution plans,
 * and writes them to data/plans/ for the executor to pick up.
 * 
 * Runs on configurable interval (default 5 min).
 */

import { type Address } from "viem";
import { SMART_ACCOUNT, MORPHO_BLUE } from "../../shared/config.js";
import { readData, writeData, listDataFiles } from "../../shared/store.js";
import type {
  CrossChainOpportunity,
  ExecutionPlan,
  ExecutionAction,
  PortfolioState,
  StoredPlan,
} from "../../shared/types.js";
import {
  buildApprove,
  buildSupply,
  buildBorrow,
  buildSupplyCollateral,
  buildWithdraw,
  buildRepay,
  buildWithdrawCollateral,
  type MarketParams,
} from "../../shared/adapters/morpho.js";
import {
  getAcrossQuote,
  buildBridgeActions,
  estimateBridgeTime,
} from "../../shared/adapters/across.js";

const INTERVAL_MS = parseInt(process.env.PLANNER_INTERVAL_MS || String(5 * 60 * 1000));
const LOOP = !process.argv.includes("--once");

// ============================================================
// Plan builders (preserved from original planner)
// ============================================================

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
  amount: bigint,
  collateralAmount: bigint,
  borrowMarketParams: MarketParams,
  supplyMarketParams: MarketParams,
): Promise<ExecutionPlan> {
  const id = `entry-${opportunity.asset}-${Date.now()}`;
  const actions: ExecutionAction[] = [];
  const borrowChainId = opportunity.borrowMarket.chainId;
  const supplyChainId = opportunity.supplyMarket.chainId;

  // ── Phase 1: Borrow chain ──
  const approveCollateral = buildApprove(
    borrowMarketParams.collateralToken,
    MORPHO_BLUE[borrowChainId],
    collateralAmount,
    borrowChainId,
    opportunity.borrowMarket.collateralAsset,
  );
  actions.push({ chainId: borrowChainId, ...approveCollateral });

  const supplyCollateral = buildSupplyCollateral(
    borrowMarketParams,
    collateralAmount,
    SMART_ACCOUNT,
    borrowChainId,
    opportunity.borrowMarket.collateralAsset,
  );
  actions.push({ chainId: borrowChainId, ...supplyCollateral });

  const borrow = buildBorrow(
    borrowMarketParams,
    amount,
    SMART_ACCOUNT,
    SMART_ACCOUNT,
    borrowChainId,
    opportunity.asset,
  );
  actions.push({ chainId: borrowChainId, ...borrow });

  // ── Phase 2: Bridge ──
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
      actions.push({ chainId: borrowChainId, ...ba });
    }
  } catch (err: any) {
    console.warn(`Bridge quote failed: ${err.message}. Plan will be incomplete.`);
  }

  // ── Phase 3: Supply chain ──
  const approveSupply = buildApprove(
    supplyMarketParams.loanToken,
    MORPHO_BLUE[supplyChainId],
    amount,
    supplyChainId,
    opportunity.asset,
  );
  actions.push({ chainId: supplyChainId, ...approveSupply });

  const supply = buildSupply(
    supplyMarketParams,
    amount,
    SMART_ACCOUNT,
    supplyChainId,
    opportunity.asset,
  );
  actions.push({ chainId: supplyChainId, ...supply });

  const estimatedGasCost = supplyChainId === 1 ? 50 : 5;
  const bridgeTimeSec = estimateBridgeTime(borrowChainId, supplyChainId);

  return {
    id,
    timestamp: Date.now(),
    opportunity,
    actions,
    estimatedGasCost,
    estimatedBridgeCost: bridgeFee / 1e6,
    estimatedNetBenefit:
      (Number(amount) / 1e6) * opportunity.grossSpread -
      estimatedGasCost -
      bridgeFee / 1e6,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
}

/**
 * Build an execution plan for exiting a cross-chain position (reverse flow)
 */
export async function planExit(
  opportunity: CrossChainOpportunity,
  supplyShares: bigint,
  borrowShares: bigint,
  supplyMarketParams: MarketParams,
  borrowMarketParams: MarketParams,
): Promise<ExecutionPlan> {
  const id = `exit-${opportunity.asset}-${Date.now()}`;
  const actions: ExecutionAction[] = [];
  const borrowChainId = opportunity.borrowMarket.chainId;
  const supplyChainId = opportunity.supplyMarket.chainId;

  const withdraw = buildWithdraw(
    supplyMarketParams,
    0n,
    supplyShares,
    SMART_ACCOUNT,
    SMART_ACCOUNT,
    supplyChainId,
    opportunity.asset,
  );
  actions.push({ chainId: supplyChainId, ...withdraw });

  const approveRepay = buildApprove(
    borrowMarketParams.loanToken,
    MORPHO_BLUE[borrowChainId],
    0n,
    borrowChainId,
    opportunity.asset,
  );
  actions.push({ chainId: borrowChainId, ...approveRepay });

  const repay = buildRepay(
    borrowMarketParams,
    0n,
    borrowShares,
    SMART_ACCOUNT,
    borrowChainId,
    opportunity.asset,
  );
  actions.push({ chainId: borrowChainId, ...repay });

  const withdrawColl = buildWithdrawCollateral(
    borrowMarketParams,
    0n,
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
    estimatedBridgeCost: 0,
    estimatedNetBenefit: 0,
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

// ============================================================
// Service loop
// ============================================================

async function runPlanCycle() {
  const cycleStart = Date.now();
  console.log("═".repeat(60));
  console.log(`Planner Cycle — ${new Date().toISOString()}`);
  console.log("═".repeat(60));

  // Read opportunities from data/
  const oppData = readData<{ timestamp: number; lowRisk: CrossChainOpportunity[] }>("opportunities.json");
  if (!oppData || !oppData.lowRisk || oppData.lowRisk.length === 0) {
    console.log("  No low-risk opportunities found. Waiting...");
    return;
  }

  // Read portfolio
  const portfolio = readData<PortfolioState>("portfolio.json");
  if (!portfolio) {
    console.log("  No portfolio data available. Waiting for watcher...");
    return;
  }

  // Check staleness (don't plan on stale data)
  const dataAge = Date.now() - oppData.timestamp;
  if (dataAge > 15 * 60 * 1000) {
    console.log(`  ⚠️ Opportunity data is ${(dataAge / 60000).toFixed(0)}min old. Skipping.`);
    return;
  }

  // Check existing pending plans to avoid duplicates
  const existingPlanFiles = listDataFiles("plans");
  const existingPlans: StoredPlan[] = [];
  for (const f of existingPlanFiles) {
    const p = readData<StoredPlan>(`plans/${f}`);
    if (p && (p.status === "pending" || p.status === "executing")) {
      existingPlans.push(p);
    }
  }

  if (existingPlans.length > 0) {
    console.log(`  ${existingPlans.length} plan(s) already pending/executing. Skipping.`);
    return;
  }

  console.log(`  ${oppData.lowRisk.length} low-risk opportunities available`);

  // Log what we would do (paper mode by default — planner creates plans, executor decides)
  for (const opp of oppData.lowRisk.slice(0, 3)) {
    console.log(
      `\n  Would enter: ${opp.asset} | ${(opp.grossSpread * 100).toFixed(2)}% spread`
    );
    console.log(
      `    Supply ${(opp.supplyMarket.supplyApyWithRewards * 100).toFixed(2)}% on ${opp.supplyMarket.chain}`
    );
    console.log(
      `    Borrow ${(opp.borrowMarket.borrowApy * 100).toFixed(2)}% on ${opp.borrowMarket.chain}`
    );
    console.log(
      `    Liquidity: $${(opp.supplyMarket.liquidityUsd / 1e6).toFixed(1)}M | Util: ${(opp.supplyMarket.utilization * 100).toFixed(0)}%`
    );

    // NOTE: In production, the planner would call planEntry() with actual MarketParams
    // fetched from the Morpho API and write StoredPlan to data/plans/
    // For now, log what would happen (same as original paper mode behavior)
    console.log("    📝 Paper trade — plan not created (no market params yet)");
  }

  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  console.log(`\n⏱️  Planner cycle completed in ${elapsed}s`);
}

async function main() {
  console.log("📋 Citadel Planner Service");
  console.log(`   Interval: ${INTERVAL_MS / 1000}s | Mode: ${LOOP ? "loop" : "once"}`);
  console.log("");

  await runPlanCycle();

  if (LOOP) {
    console.log(`\n🔄 Looping every ${INTERVAL_MS / 1000}s...`);
    setInterval(runPlanCycle, INTERVAL_MS);
  }
}

main().catch(console.error);
