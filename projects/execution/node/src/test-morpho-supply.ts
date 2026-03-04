/**
 * Test: Real Morpho supply on Base
 * 
 * Flow: Wrap 0.001 ETH → WETH → Approve Morpho → Supply WETH to a market
 * All in one batched UserOp through the smart account.
 */

import {
  encodeFunctionData,
  parseEther,
  type Address,
  type Hex,
  encodeAbiParameters,
} from "viem";
import { SMART_ACCOUNT, MORPHO_BLUE } from "./config/index.js";
import { executeViaUserOp } from "./executor/userop.js";

const BASE_CHAIN_ID = 8453;
const WETH_BASE = "0x4200000000000000000000000000000000000006" as Address;
const MORPHO_BASE = MORPHO_BLUE[BASE_CHAIN_ID];

// Amount to test with
const AMOUNT = parseEther("0.001"); // ~$2.50

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

// Mode codes
const SINGLE_EXEC_MODE = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
const BATCH_EXEC_MODE = "0x0100000000000000000000000000000000000000000000000000000000000000" as Hex;

function encodeSingleExecution(target: Address, value: bigint, calldata: Hex): Hex {
  const t = target.slice(2).toLowerCase().padStart(40, "0");
  const v = value.toString(16).padStart(64, "0");
  const c = calldata.slice(2);
  return `0x${t}${v}${c}` as Hex;
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

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("🧪 Morpho Supply Test — Base");
  console.log(`   Smart Account: ${SMART_ACCOUNT}`);
  console.log(`   Amount: 0.001 ETH → WETH → Morpho supply`);
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "🔴 LIVE"}`);
  console.log("");

  // Step 1: Wrap ETH to WETH (deposit to WETH contract)
  const wrapCalldata = encodeFunctionData({
    abi: [{ name: "deposit", type: "function", inputs: [], outputs: [], stateMutability: "payable" }],
    functionName: "deposit",
  });

  // Step 2: Approve WETH to Morpho Blue
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
    args: [MORPHO_BASE, AMOUNT],
  });

  // Step 3: Supply WETH to Morpho Blue
  // We need a real market. Let's find the best WETH market on Base.
  // Using the wrsETH/WETH market from our scanner (5% APY)
  // For safety, we'll just do a supply to ANY WETH market.
  // Morpho Blue supply requires MarketParams struct.
  
  // Let's fetch a real WETH market from Morpho API
  const res = await fetch("https://api.morpho.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query {
        markets(first: 1, orderBy: SupplyAssetsUsd, orderDirection: Desc, 
          where: { loanAssetAddress_in: ["0x4200000000000000000000000000000000000006"], chainId_in: [8453], listed: true }) {
          items {
            uniqueKey
            loanAsset { address symbol }
            collateralAsset { address symbol }
            oracleAddress
            irmAddress
            lltv
            state { supplyApy supplyAssetsUsd utilization }
          }
        }
      }`,
    }),
  });

  const data = await res.json();
  const market = data.data?.markets?.items?.[0];

  if (!market) {
    console.error("No WETH market found on Base!");
    return;
  }

  console.log(`   Market: ${market.collateralAsset.symbol}/WETH`);
  console.log(`   Supply APY: ${(market.state.supplyApy * 100).toFixed(2)}%`);
  console.log(`   TVL: $${(market.state.supplyAssetsUsd / 1e6).toFixed(1)}M`);
  console.log(`   Oracle: ${market.oracleAddress}`);
  console.log(`   IRM: ${market.irmAddress}`);
  console.log("");

  // Encode Morpho supply call
  const morphoSupplyCalldata = encodeFunctionData({
    abi: [{
      name: "supply",
      type: "function",
      inputs: [
        {
          name: "marketParams",
          type: "tuple",
          components: [
            { name: "loanToken", type: "address" },
            { name: "collateralToken", type: "address" },
            { name: "oracle", type: "address" },
            { name: "irm", type: "address" },
            { name: "lltv", type: "uint256" },
          ],
        },
        { name: "assets", type: "uint256" },
        { name: "shares", type: "uint256" },
        { name: "onBehalf", type: "address" },
        { name: "data", type: "bytes" },
      ],
      outputs: [
        { name: "assetsSupplied", type: "uint256" },
        { name: "sharesSupplied", type: "uint256" },
      ],
      stateMutability: "nonpayable",
    }],
    functionName: "supply",
    args: [
      {
        loanToken: market.loanAsset.address as Address,
        collateralToken: market.collateralAsset.address as Address,
        oracle: market.oracleAddress as Address,
        irm: market.irmAddress as Address,
        lltv: BigInt(market.lltv),
      },
      AMOUNT,
      0n, // shares = 0 (supply by assets)
      SMART_ACCOUNT,
      "0x" as Hex,
    ],
  });

  // Batch: wrap + approve + supply
  const batchCalldata = encodeBatchExecution([
    { target: WETH_BASE, value: AMOUNT, calldata: wrapCalldata },
    { target: WETH_BASE, value: 0n, calldata: approveCalldata },
    { target: MORPHO_BASE, value: 0n, calldata: morphoSupplyCalldata },
  ]);

  const nexusCalldata = encodeFunctionData({
    abi: nexusExecuteAbi,
    functionName: "execute",
    args: [BATCH_EXEC_MODE, batchCalldata],
  });

  console.log("   Actions:");
  console.log("     1. Wrap 0.001 ETH → WETH");
  console.log("     2. Approve WETH to Morpho Blue");
  console.log("     3. Supply WETH to Morpho market");
  console.log("");

  const result = await executeViaUserOp(BASE_CHAIN_ID, nexusCalldata, { dryRun });

  console.log(`\n   Result: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`);
  if (result.txHash !== "0x") console.log(`   TX: ${result.txHash}`);
  if (result.gasUsed > 0n) console.log(`   Gas used: ${result.gasUsed}`);
  if (result.error) console.log(`   Error: ${result.error}`);
}

main().catch(console.error);
