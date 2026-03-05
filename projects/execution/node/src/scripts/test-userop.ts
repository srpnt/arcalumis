/**
 * Test: Submit a real UserOperation through the smart account on Base
 * 
 * Action: Approve 0 USDC to Morpho Blue (harmless, costs only gas)
 * This tests the full flow: build UserOp → sign → submit to EntryPoint
 */

import { encodeFunctionData, parseUnits, type Address, type Hex } from "viem";
import { SMART_ACCOUNT, TOKENS } from "../shared/config.js";
import { executeViaUserOp, getAccountNonce } from "../shared/userop.js";
import { buildNexusExecuteCalldata } from "../shared/nexus.js";

const BASE_CHAIN_ID = 8453;

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

  // Wrap in Nexus execute call using shared helper
  const nexusCalldata = buildNexusExecuteCalldata([
    { target: usdcBase, value: 0n, calldata: approveCalldata },
  ]);

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
