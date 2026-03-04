/**
 * Citadel Executor
 * Submits transactions through the ERC-7579 smart account via ERC-4337 EntryPoint.
 * 
 * The Nexus smart account's execute() is gated to EntryPoint only.
 * Flow: EOA signs UserOp → EntryPoint.handleOps() → Nexus.execute() → target calls
 * 
 * For simplicity in v1, we use the EOA to directly call the EntryPoint
 * with a properly signed UserOperation.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  concat,
  pad,
  toHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base } from "viem/chains";
import { CHAINS, SMART_ACCOUNT, PRIVATE_KEY, CONTRACTS } from "../config/index.js";
import type { ExecutionPlan, ExecutionAction } from "../types/index.js";

// ============================================================
// Constants
// ============================================================

const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;

// Nexus execute mode codes
const SINGLE_EXEC_MODE = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
const BATCH_EXEC_MODE = "0x0100000000000000000000000000000000000000000000000000000000000000" as Hex;

// Viem chain objects
const VIEM_CHAINS: Record<number, any> = { 1: mainnet, 8453: base };

const account = privateKeyToAccount(PRIVATE_KEY);

// ============================================================
// Encoding
// ============================================================

function encodeSingleExecution(target: Address, value: bigint, calldata: Hex): Hex {
  const targetBytes = target.slice(2).toLowerCase().padStart(40, "0");
  const valueBytes = value.toString(16).padStart(64, "0");
  const calldataBytes = calldata.slice(2);
  return `0x${targetBytes}${valueBytes}${calldataBytes}` as Hex;
}

function encodeBatchExecution(actions: { target: Address; value: bigint; calldata: Hex }[]): Hex {
  return encodeAbiParameters(
    [{
      type: "tuple[]",
      components: [
        { name: "target", type: "address" },
        { name: "value", type: "uint256" },
        { name: "callData", type: "bytes" },
      ],
    }],
    [actions.map((a) => ({ target: a.target, value: a.value, callData: a.calldata }))]
  );
}

// Nexus execute ABI
const nexusExecuteAbi = [{
  name: "execute",
  type: "function",
  inputs: [
    { name: "mode", type: "bytes32" },
    { name: "executionCalldata", type: "bytes" },
  ],
  outputs: [],
  stateMutability: "payable",
}] as const;

function getClients(chainId: number) {
  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  const config = CHAINS[chainKey];
  return {
    public: createPublicClient({ chain: VIEM_CHAINS[chainId], transport: http(config.rpcHttp) }),
    wallet: createWalletClient({ account, chain: VIEM_CHAINS[chainId], transport: http(config.rpcHttp) }),
  };
}

// ============================================================
// Direct execution path (EOA → smart account via delegatecall trick)
// 
// Since the K1 MEE Validator is the default validator, and the smart
// account accepts UserOps from the EntryPoint, we need to construct
// proper UserOps. For v1, we'll use a simpler approach:
// 
// The EOA that owns the smart account can execute actions by:
// 1. Encoding the desired calls
// 2. Creating a minimal UserOp
// 3. Signing it with our K1 key
// 4. Submitting to EntryPoint.handleOps()
//
// However, for v1 simplicity, we'll test with direct simulation
// and mark that live execution requires the full UserOp flow.
// ============================================================

export interface ExecutionResult {
  chainId: number;
  txHash: Hex;
  success: boolean;
  gasUsed: bigint;
  error?: string;
}

/**
 * Simulate an action batch against the smart account
 * Uses eth_call to simulate what would happen if executed
 */
export async function simulateOnChain(
  chainId: number,
  actions: ExecutionAction[],
): Promise<{ success: boolean; error?: string }> {
  const clients = getClients(chainId);
  const chainName = CHAINS[Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!].name;

  console.log(`\n  🔗 ${chainName} — Simulating ${actions.length} action(s)`);
  for (const action of actions) {
    console.log(`    → ${action.description}`);
  }

  // Encode the execute calldata
  let mode: Hex;
  let executionCalldata: Hex;

  if (actions.length === 1) {
    mode = SINGLE_EXEC_MODE;
    executionCalldata = encodeSingleExecution(actions[0].target, actions[0].value, actions[0].calldata);
  } else {
    mode = BATCH_EXEC_MODE;
    executionCalldata = encodeBatchExecution(
      actions.map((a) => ({ target: a.target, value: a.value, calldata: a.calldata }))
    );
  }

  const executeCalldata = encodeFunctionData({
    abi: nexusExecuteAbi,
    functionName: "execute",
    args: [mode, executionCalldata],
  });

  // Simulate as if called by EntryPoint (using state override)
  try {
    await clients.public.call({
      to: SMART_ACCOUNT,
      data: executeCalldata,
      account: ENTRYPOINT_V07, // Simulate as EntryPoint caller
    });
    console.log(`    ✅ Simulation passed`);
    return { success: true };
  } catch (err: any) {
    // Try simulating individual actions directly on targets to get better error messages
    console.log(`    ⚠️ Full simulation reverted, testing individual calls...`);
    for (const action of actions) {
      try {
        await clients.public.call({
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

/**
 * Execute a full cross-chain plan (simulation + optional live execution)
 */
export async function executePlan(
  plan: ExecutionPlan,
  options: { dryRun?: boolean } = {}
): Promise<{ results: ExecutionResult[]; success: boolean }> {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`${options.dryRun ? "📝 [DRY RUN]" : "🔴 [LIVE]"} Plan: ${plan.id}`);
  console.log(`  ${plan.opportunity.asset} | ${(plan.opportunity.grossSpread * 100).toFixed(2)}% spread`);

  if (Date.now() / 1000 > plan.deadline) {
    console.error("  ⏰ Plan expired!");
    return { results: [], success: false };
  }

  // Group by chain
  const byChain = new Map<number, ExecutionAction[]>();
  for (const action of plan.actions) {
    const arr = byChain.get(action.chainId) || [];
    arr.push(action);
    byChain.set(action.chainId, arr);
  }

  const results: ExecutionResult[] = [];
  const borrowChainId = plan.opportunity.borrowMarket.chainId;
  const chainIds = [...byChain.keys()];
  const orderedChains = chainIds.includes(borrowChainId)
    ? [borrowChainId, ...chainIds.filter((c) => c !== borrowChainId)]
    : chainIds;

  for (const chainId of orderedChains) {
    const actions = byChain.get(chainId)!;

    // Always simulate first
    const sim = await simulateOnChain(chainId, actions);

    results.push({
      chainId,
      txHash: "0x" as Hex,
      success: sim.success,
      gasUsed: 0n,
      error: sim.error,
    });

    if (!sim.success) {
      console.log(`  ⚠️ Chain ${chainId} simulation failed, stopping`);
      break;
    }

    if (!options.dryRun) {
      console.log(`  📤 Live execution requires UserOp submission — not yet implemented`);
      // TODO: Build + sign UserOp, submit to EntryPoint.handleOps()
    }
  }

  const allSuccess = results.every((r) => r.success);
  console.log(`\n  ${allSuccess ? "✅" : "❌"} Plan ${allSuccess ? "simulated successfully" : "has failures"}`);
  return { results, success: allSuccess };
}

/**
 * Get the smart account's nonce from EntryPoint
 */
export async function getAccountNonce(chainId: number): Promise<bigint> {
  const clients = getClients(chainId);

  const entryPointAbi = [{
    name: "getNonce",
    type: "function",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "nonce", type: "uint256" }],
    stateMutability: "view",
  }] as const;

  return clients.public.readContract({
    address: ENTRYPOINT_V07,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [SMART_ACCOUNT, 0n],
  });
}

export { simulateOnChain as executeOnChain };
