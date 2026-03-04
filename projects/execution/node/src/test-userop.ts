/**
 * Test: Submit a real UserOperation through the smart account on Base
 * 
 * Action: Approve 0 USDC to Morpho Blue (harmless, costs only gas)
 * This tests the full flow: build UserOp → sign → submit to EntryPoint
 */

import { encodeFunctionData, parseUnits, type Address, type Hex } from "viem";
import { SMART_ACCOUNT, TOKENS } from "./config/index.js";
import { executeViaUserOp, getAccountNonce } from "./executor/userop.js";

const BASE_CHAIN_ID = 8453;

// Nexus execute mode + encoding
const SINGLE_EXEC_MODE = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

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

function encodeSingleExecution(target: Address, value: bigint, calldata: Hex): Hex {
  const targetBytes = target.slice(2).toLowerCase().padStart(40, "0");
  const valueBytes = value.toString(16).padStart(64, "0");
  const calldataBytes = calldata.slice(2);
  return `0x${targetBytes}${valueBytes}${calldataBytes}` as Hex;
}

async function main() {
  console.log("🧪 UserOp Test — Live on Base");
  console.log(`   Smart Account: ${SMART_ACCOUNT}`);
  console.log("");

  // Check nonce
  const nonce = await getAccountNonce(BASE_CHAIN_ID);
  console.log(`   Current nonce: ${nonce}`);

  // Build the inner call: USDC.approve(MorphoBlue, 0)
  // This is harmless — just sets an approval to 0
  const usdcBase = TOKENS.USDC[BASE_CHAIN_ID];
  const morphoBlue = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;

  const approveCalldata = encodeFunctionData({
    abi: [{
      name: "approve",
      type: "function",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
      stateMutability: "nonpayable",
    }],
    functionName: "approve",
    args: [morphoBlue, 0n],
  });

  // Wrap in Nexus execute call
  const executionCalldata = encodeSingleExecution(usdcBase, 0n, approveCalldata);

  const nexusCalldata = encodeFunctionData({
    abi: nexusExecuteAbi,
    functionName: "execute",
    args: [SINGLE_EXEC_MODE, executionCalldata],
  });

  console.log("   Action: USDC.approve(MorphoBlue, 0) via Nexus execute");
  console.log(`   Calldata: ${nexusCalldata.slice(0, 40)}...`);
  console.log("");

  // Execute!
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("   Mode: DRY RUN (will build + sign but not submit)");
  } else {
    console.log("   Mode: LIVE — will submit real transaction on Base");
  }
  console.log("");

  const result = await executeViaUserOp(BASE_CHAIN_ID, nexusCalldata, { dryRun });

  console.log(`\n   Result: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`);
  if (result.txHash !== "0x") console.log(`   TX: ${result.txHash}`);
  if (result.gasUsed > 0n) console.log(`   Gas used: ${result.gasUsed}`);
  if (result.error) console.log(`   Error: ${result.error}`);
}

main().catch(console.error);
