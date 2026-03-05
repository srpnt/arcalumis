/**
 * Test: Execute a simple action through the smart account
 * 
 * This does a dry-run simulation of a basic ERC20 transfer
 * to verify the executor can talk to the smart account correctly.
 */

import { encodeFunctionData, type Address, type Hex, parseUnits, createPublicClient, http } from "viem";
import { mainnet, base } from "viem/chains";
import { SMART_ACCOUNT, TOKENS, CHAINS } from "../shared/config.js";
import { buildNexusExecuteCalldata } from "../shared/nexus.js";
import type { ExecutionAction } from "../shared/types.js";

const BASE_CHAIN_ID = 8453;
const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;

function getPublicClient(chainId: number) {
  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  const config = CHAINS[chainKey];
  return createPublicClient({ chain: chainId === 1 ? mainnet : base, transport: http(config.rpcHttp) });
}

async function simulateActions(
  chainId: number,
  actions: ExecutionAction[],
): Promise<{ success: boolean; error?: string }> {
  const client = getPublicClient(chainId);

  const nexusCalldata = buildNexusExecuteCalldata(
    actions.map((a) => ({ target: a.target, value: a.value, calldata: a.calldata }))
  );

  try {
    await client.call({
      to: SMART_ACCOUNT,
      data: nexusCalldata,
      account: ENTRYPOINT_V07,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.shortMessage?.slice(0, 200) || err.message?.slice(0, 200) };
  }
}

async function main() {
  console.log("🧪 Executor Test — Smart Account Interaction");
  console.log(`   Smart Account: ${SMART_ACCOUNT}`);
  console.log("");

  const usdcBase = TOKENS.USDC[BASE_CHAIN_ID];
  const morphoBlue = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;

  console.log("Test 1: Simulate USDC approve via smart account (Base)");
  console.log(`  Token: ${usdcBase}`);
  console.log(`  Spender: ${morphoBlue}`);
  console.log(`  Amount: 1 USDC`);

  const result = await simulateActions(BASE_CHAIN_ID, [
    {
      chainId: BASE_CHAIN_ID,
      target: usdcBase,
      calldata: encodeFunctionData({
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
        args: [morphoBlue, parseUnits("1", 6)],
      }),
      value: 0n,
      description: "Approve 1 USDC to Morpho Blue",
    },
  ]);

  console.log(`\n  Result: ${result.success ? "✅ PASS" : "❌ FAIL"}`);
  if (result.error) console.log(`  Error: ${result.error}`);

  // Test 2: Simulate a batch (approve + another approve)
  console.log("\nTest 2: Simulate batch execution (2 approves, Base)");

  const batchResult = await simulateActions(BASE_CHAIN_ID, [
    {
      chainId: BASE_CHAIN_ID,
      target: usdcBase,
      calldata: encodeFunctionData({
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
        args: [morphoBlue, parseUnits("100", 6)],
      }),
      value: 0n,
      description: "Approve 100 USDC to Morpho Blue",
    },
    {
      chainId: BASE_CHAIN_ID,
      target: usdcBase,
      calldata: encodeFunctionData({
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
        args: ["0x0000000000000000000000000000000000000000" as Address, 0n],
      }),
      value: 0n,
      description: "Revoke USDC approval (cleanup)",
    },
  ]);

  console.log(`\n  Result: ${batchResult.success ? "✅ PASS" : "❌ FAIL"}`);
  if (batchResult.error) console.log(`  Error: ${batchResult.error}`);

  console.log("\n🏁 Tests complete");
}

main().catch(console.error);
