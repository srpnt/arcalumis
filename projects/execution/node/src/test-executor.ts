/**
 * Test: Execute a simple action through the smart account
 * 
 * This does a dry-run simulation of a basic ERC20 transfer
 * to verify the executor can talk to the smart account correctly.
 */

import { encodeFunctionData, type Address, type Hex, parseUnits } from "viem";
import { SMART_ACCOUNT, TOKENS } from "./config/index.js";
import { executeOnChain } from "./executor/index.js";

const BASE_CHAIN_ID = 8453;

async function main() {
  console.log("🧪 Executor Test — Smart Account Interaction");
  console.log(`   Smart Account: ${SMART_ACCOUNT}`);
  console.log("");

  // Test 1: Simulate a USDC balance check (view call through execute)
  // We'll try to approve USDC to an address — this tests the full path
  // EOA → Nexus.execute() → USDC.approve()
  // Using dry run so no actual tx is sent

  const usdcBase = TOKENS.USDC[BASE_CHAIN_ID];
  const morphoBlue = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;

  console.log("Test 1: Simulate USDC approve via smart account (Base)");
  console.log(`  Token: ${usdcBase}`);
  console.log(`  Spender: ${morphoBlue}`);
  console.log(`  Amount: 1 USDC`);

  const result = await executeOnChain(
    BASE_CHAIN_ID,
    [
      {
        chainId: BASE_CHAIN_ID,
        target: usdcBase,
        calldata: encodeFunctionData({
          abi: [
            {
              name: "approve",
              type: "function",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable",
            },
          ],
          functionName: "approve",
          args: [morphoBlue, parseUnits("1", 6)],
        }),
        value: 0n,
        description: "Approve 1 USDC to Morpho Blue",
      },
    ],
    { simulate: true, dryRun: true }
  );

  console.log(`\n  Result: ${result.success ? "✅ PASS" : "❌ FAIL"}`);
  if (result.error) console.log(`  Error: ${result.error}`);

  // Test 2: Simulate a batch (approve + another approve)
  console.log("\nTest 2: Simulate batch execution (2 approves, Base)");

  const batchResult = await executeOnChain(
    BASE_CHAIN_ID,
    [
      {
        chainId: BASE_CHAIN_ID,
        target: usdcBase,
        calldata: encodeFunctionData({
          abi: [
            {
              name: "approve",
              type: "function",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable",
            },
          ],
          functionName: "approve",
          args: [morphoBlue, parseUnits("100", 6)],
        }),
        value: 0n,
        description: "Approve 100 USDC to Morpho Blue",
      },
      {
        chainId: BASE_CHAIN_ID,
        target: usdcBase,
        calldata: encodeFunctionData({
          abi: [
            {
              name: "approve",
              type: "function",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable",
            },
          ],
          functionName: "approve",
          args: ["0x0000000000000000000000000000000000000000" as Address, 0n],
        }),
        value: 0n,
        description: "Revoke USDC approval (cleanup)",
      },
    ],
    { simulate: true, dryRun: true }
  );

  console.log(`\n  Result: ${batchResult.success ? "✅ PASS" : "❌ FAIL"}`);
  if (batchResult.error) console.log(`  Error: ${batchResult.error}`);

  console.log("\n🏁 Tests complete");
}

main().catch(console.error);
