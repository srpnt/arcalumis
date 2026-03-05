/**
 * Emergency Exit — Withdraw all positions and sweep funds to EOA
 * 
 * Usage:
 *   npx tsx src/services/monitor/emergency.ts base          # Exit all on Base
 *   npx tsx src/services/monitor/emergency.ts ethereum      # Exit all on Ethereum
 *   npx tsx src/services/monitor/emergency.ts all           # Exit all on all chains
 *   npx tsx src/services/monitor/emergency.ts base --dry-run  # Simulate only
 */

import {
  encodeFunctionData,
  createPublicClient,
  http,
  erc20Abi,
  formatEther,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base } from "viem/chains";
import { SMART_ACCOUNT, CHAINS, PRIVATE_KEY, MORPHO_BLUE, TOKENS } from "../../shared/config.js";
import { executeViaUserOp } from "../../shared/userop.js";
import { buildNexusExecuteCalldata } from "../../shared/nexus.js";

const VIEM_CHAINS: Record<number, any> = { 1: mainnet, 8453: base };
const account = privateKeyToAccount(PRIVATE_KEY);

// ============================================================
// Morpho position detection
// ============================================================

const morphoPositionAbi = [
  {
    name: "position",
    type: "function",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "supplyShares", type: "uint256" },
      { name: "borrowShares", type: "uint128" },
      { name: "collateral", type: "uint128" },
    ],
    stateMutability: "view",
  },
] as const;

const morphoWithdrawAbi = [{
  name: "withdraw",
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
    { name: "receiver", type: "address" },
  ],
  outputs: [
    { name: "assetsWithdrawn", type: "uint256" },
    { name: "sharesWithdrawn", type: "uint256" },
  ],
  stateMutability: "nonpayable",
}] as const;

interface MorphoMarketInfo {
  id: string;
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
  loanSymbol: string;
  collateralSymbol: string;
}

async function findOpenPositions(chainId: number): Promise<{
  market: MorphoMarketInfo;
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
}[]> {
  const res = await fetch("https://api.morpho.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query {
        markets(first: 200, where: { chainId_in: [${chainId}], listed: true }, orderBy: SupplyAssetsUsd, orderDirection: Desc) {
          items {
            uniqueKey
            loanAsset { address symbol }
            collateralAsset { address symbol }
            oracleAddress
            irmAddress
            lltv
          }
        }
      }`,
    }),
  });

  const data = await res.json();
  const markets = data.data?.markets?.items || [];

  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  const config = CHAINS[chainKey];
  const client = createPublicClient({ chain: VIEM_CHAINS[chainId], transport: http(config.rpcHttp) });

  const positions: any[] = [];

  for (const m of markets) {
    try {
      const [supplyShares, borrowShares, collateral] = await client.readContract({
        address: MORPHO_BLUE[chainId],
        abi: morphoPositionAbi,
        functionName: "position",
        args: [m.uniqueKey as Hex, SMART_ACCOUNT],
      });

      if (supplyShares > 0n || borrowShares > 0n || collateral > 0n) {
        positions.push({
          market: {
            id: m.uniqueKey,
            loanToken: m.loanAsset.address,
            collateralToken: m.collateralAsset.address,
            oracle: m.oracleAddress,
            irm: m.irmAddress,
            lltv: BigInt(m.lltv),
            loanSymbol: m.loanAsset.symbol,
            collateralSymbol: m.collateralAsset.symbol,
          },
          supplyShares,
          borrowShares: BigInt(borrowShares),
          collateral: BigInt(collateral),
        });
      }
    } catch {
      // Skip markets that fail to read
    }
  }

  return positions;
}

// ============================================================
// Token balance detection  
// ============================================================

async function findTokenBalances(chainId: number): Promise<{ address: Address; symbol: string; balance: bigint; decimals: number }[]> {
  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  const config = CHAINS[chainKey];
  const client = createPublicClient({ chain: VIEM_CHAINS[chainId], transport: http(config.rpcHttp) });

  const knownTokens: { address: Address; symbol: string; decimals: number }[] = [];
  for (const [symbol, addrs] of Object.entries(TOKENS)) {
    const addr = addrs[chainId];
    if (addr) knownTokens.push({ address: addr, symbol, decimals: ["USDC", "USDT", "EURC"].includes(symbol) ? 6 : 18 });
  }
  if (chainId === 8453) knownTokens.push({ address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 });
  if (chainId === 1) knownTokens.push({ address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 });

  const results: any[] = [];
  for (const token of knownTokens) {
    try {
      const balance = await client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [SMART_ACCOUNT],
      });
      if (balance > 0n) {
        results.push({ ...token, balance });
      }
    } catch {}
  }

  return results;
}

// ============================================================
// Emergency actions
// ============================================================

async function emergencyExitChain(chainId: number, dryRun: boolean) {
  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  const chainName = CHAINS[chainKey].name;

  console.log(`\n🚨 Emergency Exit — ${chainName}`);
  console.log("─".repeat(40));

  // 1. Find open Morpho positions
  console.log("  Scanning Morpho positions...");
  const positions = await findOpenPositions(chainId);
  console.log(`  Found ${positions.length} open position(s)`);

  const actions: { target: Address; value: bigint; calldata: Hex; desc: string }[] = [];

  for (const pos of positions) {
    const m = pos.market;
    console.log(`\n  Position: ${m.collateralSymbol}/${m.loanSymbol}`);
    console.log(`    Supply shares: ${pos.supplyShares}`);
    console.log(`    Borrow shares: ${pos.borrowShares}`);
    console.log(`    Collateral: ${pos.collateral}`);

    if (pos.supplyShares > 0n) {
      actions.push({
        target: MORPHO_BLUE[chainId],
        value: 0n,
        calldata: encodeFunctionData({
          abi: morphoWithdrawAbi,
          functionName: "withdraw",
          args: [
            {
              loanToken: m.loanToken,
              collateralToken: m.collateralToken,
              oracle: m.oracle,
              irm: m.irm,
              lltv: m.lltv,
            },
            0n,
            pos.supplyShares,
            SMART_ACCOUNT,
            SMART_ACCOUNT,
          ],
        }),
        desc: `Withdraw all ${m.loanSymbol} supply from ${m.collateralSymbol}/${m.loanSymbol}`,
      });
    }
  }

  // 2. Find token balances and sweep to EOA
  console.log("\n  Scanning token balances...");
  const balances = await findTokenBalances(chainId);

  for (const b of balances) {
    console.log(`    ${b.symbol}: ${formatUnits(b.balance, b.decimals)}`);
    actions.push({
      target: b.address,
      value: 0n,
      calldata: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [account.address, b.balance],
      }),
      desc: `Sweep ${b.symbol} to EOA`,
    });
  }

  if (actions.length === 0) {
    console.log("\n  ✅ Nothing to exit — no positions or balances found");
    return;
  }

  // Execute
  console.log(`\n  ${actions.length} action(s) to execute:`);
  for (const a of actions) {
    console.log(`    → ${a.desc}`);
  }

  const nexusCalldata = buildNexusExecuteCalldata(
    actions.map((a) => ({ target: a.target, value: a.value, calldata: a.calldata }))
  );

  const result = await executeViaUserOp(chainId, nexusCalldata, { dryRun });

  console.log(`\n  ${result.success ? "✅" : "❌"} Exit ${result.success ? "completed" : "FAILED"}`);
  if (result.txHash !== "0x") console.log(`  TX: ${result.txHash}`);
  if (result.error) console.log(`  Error: ${result.error}`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  const target = process.argv[2] || "all";
  const dryRun = process.argv.includes("--dry-run");

  console.log("🚨🚨🚨 EMERGENCY EXIT 🚨🚨🚨");
  console.log(`Target: ${target}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (simulation only)" : "🔴 LIVE — WILL EXECUTE"}`);
  console.log("");

  if (!dryRun) {
    console.log("⚠️  This will withdraw ALL positions and sweep ALL tokens to EOA.");
    console.log("    Press Ctrl+C within 5 seconds to abort...\n");
    await new Promise((r) => setTimeout(r, 5000));
  }

  const chainIds: number[] = [];
  if (target === "all") {
    chainIds.push(...Object.values(CHAINS).map((c) => c.id));
  } else {
    const chain = CHAINS[target];
    if (!chain) {
      console.error(`Unknown chain: ${target}. Use: base, ethereum, or all`);
      process.exit(1);
    }
    chainIds.push(chain.id);
  }

  for (const chainId of chainIds) {
    await emergencyExitChain(chainId, dryRun);
  }

  console.log("\n🏁 Emergency exit complete.");
}

main().catch(console.error);
