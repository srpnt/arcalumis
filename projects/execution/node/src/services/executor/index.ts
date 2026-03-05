/**
 * Executor Service
 * 
 * Reads pending plans from data/plans/, builds UserOps, signs, and submits
 * them via the EntryPoint. Updates plan status and writes execution results.
 * 
 * Uses the battle-tested UserOp pipeline from shared/userop.ts.
 * 
 * Runs on configurable interval (default 30s — faster than other services
 * since we want to execute pending plans promptly).
 */

import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { mainnet, base } from "viem/chains";
import { CHAINS, SMART_ACCOUNT } from "../../shared/config.js";
import { readData, writeData, listDataFiles } from "../../shared/store.js";
import { executeViaUserOp } from "../../shared/userop.js";
import {
  buildNexusExecuteCalldata,
  encodeSingleExecution,
  encodeBatchExecution,
  nexusExecuteAbi,
  SINGLE_EXEC_MODE,
  BATCH_EXEC_MODE,
} from "../../shared/nexus.js";
import type {
  ExecutionAction,
  ExecutionPlan,
  ExecutionResult,
  StoredPlan,
} from "../../shared/types.js";

const INTERVAL_MS = parseInt(process.env.EXECUTOR_INTERVAL_MS || "30000");
const LOOP = !process.argv.includes("--once");
const DRY_RUN = process.argv.includes("--dry-run");

const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;
const VIEM_CHAINS: Record<number, any> = { 1: mainnet, 8453: base };

// ============================================================
// Simulation
// ============================================================

function getPublicClient(chainId: number) {
  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  const config = CHAINS[chainKey];
  return createPublicClient({ chain: VIEM_CHAINS[chainId], transport: http(config.rpcHttp) });
}

/**
 * Simulate an action batch against the smart account
 * Uses eth_call to simulate what would happen if executed via EntryPoint
 */
async function simulateActions(
  chainId: number,
  actions: ExecutionAction[],
): Promise<{ success: boolean; error?: string }> {
  const client = getPublicClient(chainId);
  const chainName = CHAINS[Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!].name;

  console.log(`\n  🔗 ${chainName} — Simulating ${actions.length} action(s)`);
  for (const action of actions) {
    console.log(`    → ${action.description}`);
  }

  const nexusCalldata = buildNexusExecuteCalldata(
    actions.map((a) => ({ target: a.target, value: a.value, calldata: a.calldata }))
  );

  try {
    await client.call({
      to: SMART_ACCOUNT,
      data: nexusCalldata,
      account: ENTRYPOINT_V07, // Simulate as EntryPoint caller
    });
    console.log(`    ✅ Simulation passed`);
    return { success: true };
  } catch (err: any) {
    console.log(`    ⚠️ Simulation reverted, testing individual calls...`);
    for (const action of actions) {
      try {
        await client.call({
          to: action.target,
          data: action.calldata,
          account: SMART_ACCOUNT,
        });
        console.log(`    ✅ ${action.description} — OK`);
      } catch (innerErr: any) {
        console.log(`    ❌ ${action.description} — ${innerErr.shortMessage?.slice(0, 100) || "failed"}`);
      }
    }
    return { success: false, error: err.shortMessage?.slice(0, 200) || err.message?.slice(0, 200) };
  }
}

// ============================================================
// Execute a plan's actions on a single chain via UserOp
// ============================================================

/**
 * Execute actions for a single chain through the UserOp pipeline.
 * 
 * Flow:
 * 1. Group actions by chain
 * 2. Encode as batch/single execution calldata
 * 3. Wrap in Nexus execute() calldata
 * 4. Pass to executeViaUserOp() (build → sign → submit)
 */
async function executeChainActions(
  chainId: number,
  actions: ExecutionAction[],
  dryRun: boolean,
): Promise<ExecutionResult> {
  const chainName = CHAINS[Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!].name;
  console.log(`\n  🔗 ${chainName} — Executing ${actions.length} action(s)`);

  // Step 1: Simulate first (always)
  const sim = await simulateActions(chainId, actions);
  if (!sim.success) {
    return {
      chainId,
      txHash: "0x" as Hex,
      success: false,
      gasUsed: 0n,
      error: sim.error || "Simulation failed",
      timestamp: Date.now(),
    };
  }

  if (dryRun) {
    console.log(`    📝 Dry run — not submitting`);
    return {
      chainId,
      txHash: "0x" as Hex,
      success: true,
      gasUsed: 0n,
      timestamp: Date.now(),
    };
  }

  // Step 2: Build Nexus execute() calldata
  const nexusCalldata = buildNexusExecuteCalldata(
    actions.map((a) => ({ target: a.target, value: a.value, calldata: a.calldata }))
  );

  // Step 3: Execute via UserOp pipeline (build → sign → submit)
  const result = await executeViaUserOp(chainId, nexusCalldata);

  return {
    chainId,
    txHash: result.txHash,
    success: result.success,
    gasUsed: result.gasUsed,
    error: result.error,
    timestamp: Date.now(),
  };
}

// ============================================================
// Execute a full plan
// ============================================================

async function executePlan(
  storedPlan: StoredPlan,
  planFilename: string,
): Promise<void> {
  const plan = storedPlan.plan;
  const dryRun = DRY_RUN;

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${dryRun ? "📝 [DRY RUN]" : "🔴 [LIVE]"} Plan: ${plan.id}`);
  console.log(`  ${plan.opportunity.asset} | ${(plan.opportunity.grossSpread * 100).toFixed(2)}% spread`);

  // Check expiry
  if (Date.now() / 1000 > plan.deadline) {
    console.error("  ⏰ Plan expired!");
    storedPlan.status = "failed";
    storedPlan.error = "Plan expired before execution";
    storedPlan.updatedAt = Date.now();
    writeData(`plans/${planFilename}`, storedPlan);
    return;
  }

  // Mark as executing
  storedPlan.status = "executing";
  storedPlan.updatedAt = Date.now();
  writeData(`plans/${planFilename}`, storedPlan);

  // Group actions by chain
  const byChain = new Map<number, ExecutionAction[]>();
  for (const action of plan.actions) {
    const arr = byChain.get(action.chainId) || [];
    arr.push(action);
    byChain.set(action.chainId, arr);
  }

  // Order chains: borrow chain first (in entry plans)
  const borrowChainId = plan.opportunity.borrowMarket.chainId;
  const chainIds = [...byChain.keys()];
  const orderedChains = chainIds.includes(borrowChainId)
    ? [borrowChainId, ...chainIds.filter((c) => c !== borrowChainId)]
    : chainIds;

  const results: ExecutionResult[] = [];
  let allSuccess = true;

  for (const chainId of orderedChains) {
    const actions = byChain.get(chainId)!;
    const result = await executeChainActions(chainId, actions, dryRun);
    results.push(result);

    if (!result.success) {
      allSuccess = false;
      console.log(`  ⚠️ Chain ${chainId} execution failed, stopping`);
      break;
    }
  }

  // Update plan status
  storedPlan.status = allSuccess ? "completed" : "failed";
  storedPlan.executionResults = results;
  storedPlan.updatedAt = Date.now();
  if (!allSuccess) {
    storedPlan.error = results.find((r) => !r.success)?.error || "Execution failed";
  }
  writeData(`plans/${planFilename}`, storedPlan);

  // Write execution result
  writeData(`executions/${plan.id}-${Date.now()}.json`, {
    planId: plan.id,
    timestamp: Date.now(),
    success: allSuccess,
    results,
    dryRun,
  });

  console.log(`\n  ${allSuccess ? "✅" : "❌"} Plan ${plan.id} ${allSuccess ? "completed" : "failed"}`);
}

// ============================================================
// Service loop
// ============================================================

async function runExecutorCycle() {
  console.log(`\nExecutor check @ ${new Date().toISOString()}`);

  // Find pending plans
  const planFiles = listDataFiles("plans");
  let pending = 0;

  for (const filename of planFiles) {
    const storedPlan = readData<StoredPlan>(`plans/${filename}`);
    if (!storedPlan || storedPlan.status !== "pending") continue;

    pending++;
    await executePlan(storedPlan, filename);
  }

  if (pending === 0) {
    console.log("  No pending plans.");
  }
}

async function main() {
  console.log("⚡ Citadel Executor Service");
  console.log(`   Interval: ${INTERVAL_MS / 1000}s | Mode: ${LOOP ? "loop" : "once"} | DryRun: ${DRY_RUN}`);
  console.log("");

  await runExecutorCycle();

  if (LOOP) {
    console.log(`\n🔄 Polling every ${INTERVAL_MS / 1000}s for pending plans...`);
    setInterval(runExecutorCycle, INTERVAL_MS);
  }
}

main().catch(console.error);
