/**
 * Supply 15 USDC to the best USDC market on Morpho Blue (Base)
 * 
 * Flow: Approve USDC → Supply to Morpho market
 * Single batched UserOp.
 */

import {
  encodeFunctionData,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { SMART_ACCOUNT, MORPHO_BLUE } from "../shared/config.js";
import { executeViaUserOp } from "../shared/userop.js";
import { buildNexusExecuteCalldata } from "../shared/nexus.js";

const BASE_CHAIN_ID = 8453;
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const MORPHO_BASE = MORPHO_BLUE[BASE_CHAIN_ID];
const AMOUNT = parseUnits("15", 6); // 15 USDC

async function main() {
  console.log("🏰 Supply 15 USDC to Morpho Blue on Base");
  console.log(`   Smart Account: ${SMART_ACCOUNT}`);
  console.log("");

  // Find best USDC market on Base
  const res = await fetch("https://api.morpho.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query {
        markets(first: 5, orderBy: SupplyAssetsUsd, orderDirection: Desc, 
          where: { loanAssetAddress_in: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"], chainId_in: [8453], listed: true }) {
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
  const markets = data.data?.markets?.items || [];

  if (!markets.length) {
    console.error("No USDC markets found on Base!");
    return;
  }

  // Pick the largest market
  const market = markets[0];
  console.log(`   Market: ${market.collateralAsset.symbol}/USDC`);
  console.log(`   Supply APY: ${(market.state.supplyApy * 100).toFixed(2)}%`);
  console.log(`   TVL: $${(market.state.supplyAssetsUsd / 1e6).toFixed(1)}M`);
  console.log(`   Utilization: ${(market.state.utilization * 100).toFixed(1)}%`);
  console.log("");

  // Approve USDC to Morpho
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

  // Supply USDC
  const supplyCalldata = encodeFunctionData({
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
      0n,
      SMART_ACCOUNT,
      "0x" as Hex,
    ],
  });

  // Build Nexus execute calldata using shared helper
  const nexusCalldata = buildNexusExecuteCalldata([
    { target: USDC_BASE, value: 0n, calldata: approveCalldata },
    { target: MORPHO_BASE, value: 0n, calldata: supplyCalldata },
  ]);

  console.log("   Actions:");
  console.log("     1. Approve 15 USDC to Morpho Blue");
  console.log("     2. Supply 15 USDC to market");
  console.log("");

  const result = await executeViaUserOp(BASE_CHAIN_ID, nexusCalldata);

  console.log(`\n   Result: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`);
  if (result.txHash !== "0x") console.log(`   TX: ${result.txHash}`);
  if (result.gasUsed > 0n) console.log(`   Gas used: ${result.gasUsed}`);
  if (result.error) console.log(`   Error: ${result.error}`);
}

main().catch(console.error);
