/**
 * Monitor Service
 * 
 * Independent health checker — must work even if other services are down.
 * Checks EOA balance, EntryPoint deposit, Morpho positions, token balances,
 * and service liveness. Writes status to data/monitor.json.
 * 
 * Can trigger emergency exit if critical thresholds hit.
 */

import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  erc20Abi,
  type Address,
} from "viem";
import { mainnet, base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS, SMART_ACCOUNT, PRIVATE_KEY, MORPHO_BLUE, TOKENS } from "../../shared/config.js";
import { writeData, getDataMtime } from "../../shared/store.js";
import type {
  MonitorStatus,
  ChainMonitorStatus,
  ServiceLiveness,
  MonitorAlert,
} from "../../shared/types.js";

const INTERVAL_MS = parseInt(process.env.MONITOR_INTERVAL_MS || String(2 * 60 * 1000));
const LOOP = !process.argv.includes("--once");

const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;
const VIEM_CHAINS: Record<number, any> = { 1: mainnet, 8453: base };
const account = privateKeyToAccount(PRIVATE_KEY);

// Thresholds
const MIN_EOA_ETH_WEI = BigInt("500000000000000"); // 0.0005 ETH
const MIN_ENTRYPOINT_DEPOSIT_WEI = BigInt("1000000000000000"); // 0.001 ETH
const SERVICE_STALE_MS = 15 * 60 * 1000; // 15 minutes

// ABIs
const entryPointBalanceOfAbi = [{
  name: "balanceOf",
  type: "function",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
  stateMutability: "view",
}] as const;

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

function getClient(chainId: number) {
  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  return createPublicClient({ chain: VIEM_CHAINS[chainId], transport: http(CHAINS[chainKey].rpcHttp) });
}

// ============================================================
// Chain health checks
// ============================================================

async function checkChain(chainId: number): Promise<{ status: ChainMonitorStatus; alerts: MonitorAlert[] }> {
  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  const chainName = CHAINS[chainKey].name;
  const client = getClient(chainId);
  const alerts: MonitorAlert[] = [];

  // EOA ETH balance (for gas)
  const eoaBalance = await client.getBalance({ address: account.address });
  if (eoaBalance < MIN_EOA_ETH_WEI) {
    alerts.push({
      level: eoaBalance === 0n ? "critical" : "warning",
      message: `Low EOA ETH on ${chainName}: ${formatEther(eoaBalance)} ETH`,
      timestamp: Date.now(),
    });
  }

  // EntryPoint deposit
  let entryPointDeposit = 0n;
  try {
    entryPointDeposit = await client.readContract({
      address: ENTRYPOINT_V07,
      abi: entryPointBalanceOfAbi,
      functionName: "balanceOf",
      args: [SMART_ACCOUNT],
    });
    if (entryPointDeposit < MIN_ENTRYPOINT_DEPOSIT_WEI) {
      alerts.push({
        level: entryPointDeposit === 0n ? "critical" : "warning",
        message: `Low EntryPoint deposit on ${chainName}: ${formatEther(entryPointDeposit)} ETH`,
        timestamp: Date.now(),
      });
    }
  } catch {}

  // Smart account token balances
  const tokenBalances: { symbol: string; balance: string; formatted: string }[] = [];
  for (const [symbol, addrs] of Object.entries(TOKENS)) {
    const addr = addrs[chainId];
    if (!addr) continue;
    try {
      const bal = await client.readContract({
        address: addr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [SMART_ACCOUNT],
      });
      if (bal > 0n) {
        const decimals = ["USDC", "USDT", "EURC"].includes(symbol) ? 6 : 18;
        tokenBalances.push({
          symbol,
          balance: bal.toString(),
          formatted: formatUnits(bal, decimals),
        });
      }
    } catch {}
  }

  // Morpho positions
  const morphoPositions: ChainMonitorStatus["morphoPositions"] = [];
  try {
    const res = await fetch("https://api.morpho.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { markets(first: 200, where: { chainId_in: [${chainId}], listed: true }, orderBy: SupplyAssetsUsd, orderDirection: Desc) { items { uniqueKey loanAsset { symbol } collateralAsset { symbol } } } }`,
      }),
    });
    const data = await res.json();
    const markets = data.data?.markets?.items || [];

    for (const m of markets) {
      try {
        const [supplyShares, borrowShares, collateral] = await client.readContract({
          address: MORPHO_BLUE[chainId],
          abi: morphoPositionAbi,
          functionName: "position",
          args: [m.uniqueKey as `0x${string}`, SMART_ACCOUNT],
        });

        if (supplyShares > 0n || borrowShares > 0n || collateral > 0n) {
          morphoPositions.push({
            marketId: m.uniqueKey,
            loanAsset: m.loanAsset.symbol,
            collateralAsset: m.collateralAsset.symbol,
            supplyShares: supplyShares.toString(),
            borrowShares: borrowShares.toString(),
            collateral: collateral.toString(),
          });
        }
      } catch {}
    }
  } catch (err: any) {
    console.warn(`  ⚠️ Morpho position check failed on ${chainName}: ${err.message}`);
  }

  return {
    status: {
      chainId,
      chainName,
      eoaEthBalance: formatEther(eoaBalance),
      eoaEthBalanceWei: eoaBalance.toString(),
      entryPointDeposit: formatEther(entryPointDeposit),
      entryPointDepositWei: entryPointDeposit.toString(),
      smartAccountTokens: tokenBalances,
      morphoPositions,
    },
    alerts,
  };
}

// ============================================================
// Service liveness checks
// ============================================================

function checkServiceLiveness(): ServiceLiveness {
  const now = Date.now();

  function check(filename: string): { lastWrite: number | null; healthy: boolean } {
    const mtime = getDataMtime(filename);
    return {
      lastWrite: mtime,
      healthy: mtime !== null && (now - mtime) < SERVICE_STALE_MS,
    };
  }

  return {
    watcher: check("portfolio.json"),
    planner: check("opportunities.json"),
    executor: check("executions"), // check directory mtime
    monitor: { lastWrite: now, healthy: true }, // we're running right now
  };
}

// ============================================================
// Monitor cycle
// ============================================================

async function runMonitorCycle() {
  const cycleStart = Date.now();
  console.log("═".repeat(60));
  console.log(`Monitor Check — ${new Date().toISOString()}`);
  console.log("═".repeat(60));

  const allAlerts: MonitorAlert[] = [];
  const chainStatuses: Record<number, ChainMonitorStatus> = {};

  for (const [key, config] of Object.entries(CHAINS)) {
    console.log(`\n  Checking ${config.name}...`);
    try {
      const { status, alerts } = await checkChain(config.id);
      chainStatuses[config.id] = status;
      allAlerts.push(...alerts);

      console.log(`    EOA ETH: ${status.eoaEthBalance}`);
      console.log(`    EntryPoint deposit: ${status.entryPointDeposit}`);
      if (status.smartAccountTokens.length > 0) {
        for (const t of status.smartAccountTokens) {
          console.log(`    ${t.symbol}: ${t.formatted}`);
        }
      }
      if (status.morphoPositions.length > 0) {
        console.log(`    Morpho positions: ${status.morphoPositions.length}`);
        for (const p of status.morphoPositions) {
          console.log(`      ${p.collateralAsset}/${p.loanAsset} — supply: ${p.supplyShares}, borrow: ${p.borrowShares}`);
        }
      }
    } catch (err: any) {
      console.error(`    ❌ ${config.name} check failed: ${err.message}`);
      allAlerts.push({
        level: "critical",
        message: `${config.name} health check failed: ${err.message}`,
        timestamp: Date.now(),
      });
    }
  }

  // Service liveness
  const services = checkServiceLiveness();
  console.log("\n  Service liveness:");
  for (const [name, status] of Object.entries(services)) {
    const icon = status.healthy ? "✅" : "⚠️";
    const age = status.lastWrite ? `${((Date.now() - status.lastWrite) / 1000).toFixed(0)}s ago` : "never";
    console.log(`    ${icon} ${name}: ${age}`);
    if (!status.healthy && name !== "monitor") {
      allAlerts.push({
        level: "warning",
        message: `Service '${name}' appears stale (last write: ${age})`,
        timestamp: Date.now(),
      });
    }
  }

  // Print alerts
  if (allAlerts.length > 0) {
    console.log(`\n  🚨 ${allAlerts.length} alert(s):`);
    for (const a of allAlerts) {
      const icon = a.level === "critical" ? "🔴" : "🟡";
      console.log(`    ${icon} ${a.message}`);
    }
  } else {
    console.log("\n  ✅ All clear — no alerts");
  }

  // Write monitor status
  const monitorStatus: MonitorStatus = {
    timestamp: Date.now(),
    chains: chainStatuses,
    services,
    alerts: allAlerts,
  };

  writeData("monitor.json", monitorStatus);

  // TODO: If critical alerts, trigger emergency exit
  const criticalAlerts = allAlerts.filter((a) => a.level === "critical");
  if (criticalAlerts.length > 0) {
    console.log(`\n  ⚠️ ${criticalAlerts.length} CRITICAL alert(s) — emergency exit not yet auto-triggered`);
    console.log("     Run: npm run emergency");
  }

  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  console.log(`\n⏱️  Monitor cycle completed in ${elapsed}s`);
}

async function main() {
  console.log("🔍 Citadel Monitor Service");
  console.log(`   Interval: ${INTERVAL_MS / 1000}s | Mode: ${LOOP ? "loop" : "once"}`);
  console.log("");

  await runMonitorCycle();

  if (LOOP) {
    console.log(`\n🔄 Looping every ${INTERVAL_MS / 1000}s...`);
    setInterval(runMonitorCycle, INTERVAL_MS);
  }
}

main().catch(console.error);
