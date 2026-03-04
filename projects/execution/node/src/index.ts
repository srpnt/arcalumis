/**
 * Citadel Node — Main Entry Point
 * 
 * Modes:
 *   --watch    Run watcher only (monitor rates + portfolio)
 *   --paper    Watch + plan (log what would execute, don't submit)
 *   --live     Watch + plan + execute (real transactions)
 * 
 * Default: --paper (safe)
 */

import { fetchAllMarkets, findOpportunities } from "./watcher/morpho.js";
import { fetchPortfolio, formatPortfolio } from "./watcher/portfolio.js";
import { logPlan } from "./planner/index.js";
import { CHAINS, SMART_ACCOUNT } from "./config/index.js";
import type { NodeMode, NodeState, CrossChainOpportunity } from "./types/index.js";

// Parse mode from args
const args = process.argv.slice(2);
const mode: NodeMode = args.includes("--live") ? "live" : "paper";
const watchOnly = args.includes("--watch");
const once = !args.includes("--loop");

console.log(`
╔══════════════════════════════════════════════════════╗
║                 🏰 CITADEL NODE                      ║
║                                                      ║
║  Smart Account: ${SMART_ACCOUNT.slice(0, 10)}...${SMART_ACCOUNT.slice(-6)}          ║
║  Mode: ${(mode === "live" ? "🔴 LIVE" : "📝 PAPER").padEnd(14)}${watchOnly ? " (watch only)" : "                "}     ║
║  Chains: ${Object.values(CHAINS).map((c) => c.name).join(", ").padEnd(40)}  ║
╚══════════════════════════════════════════════════════╝
`);

if (mode === "live") {
  console.log("⚠️  LIVE MODE — Real transactions will be submitted!");
  console.log("    Press Ctrl+C within 5 seconds to abort...\n");
  await new Promise((r) => setTimeout(r, 5000));
}

const state: NodeState = {
  mode,
  lastScan: 0,
  opportunities: [],
  portfolio: null,
  activePlans: [],
};

async function runCycle() {
  const cycleStart = Date.now();
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Cycle @ ${new Date().toISOString()} | Mode: ${mode}`);
  console.log("═".repeat(60));

  // 1. Portfolio
  console.log("\n📊 Portfolio...");
  try {
    state.portfolio = await fetchPortfolio();
    console.log(formatPortfolio(state.portfolio));
  } catch (err: any) {
    console.error("  Portfolio error:", err.message);
  }

  // 2. Markets
  console.log("🔍 Scanning markets...");
  const targetChainIds = Object.values(CHAINS).map((c) => c.id);
  const markets = await fetchAllMarkets();
  const targetMarkets = markets.filter((m) => targetChainIds.includes(m.chainId));
  console.log(`  ${targetMarkets.length} markets on ${targetChainIds.join(", ")}`);

  // 3. Opportunities
  state.opportunities = findOpportunities(markets, {
    minSpreadPct: 0.5,
    targetChainIds,
  });

  const lowRisk = findOpportunities(markets, {
    minSpreadPct: 1.0,
    targetChainIds,
    positiveborrowOnly: true,
    minSupplyTvl: 500_000,
  });

  console.log(`\n⚡ ${state.opportunities.length} opportunities | 🎯 ${lowRisk.length} low-risk`);

  // Print top 5
  for (const opp of state.opportunities.slice(0, 5)) {
    const s = opp.supplyMarket;
    const b = opp.borrowMarket;
    const tag = opp.rewardDependencyPct > 0.5 ? "💎" : opp.rewardDependencyPct > 0 ? "🔸" : "🟢";
    console.log(
      `  ${tag} ${opp.asset.padEnd(8)} ${(opp.grossSpread * 100).toFixed(2).padStart(6)}% | ` +
        `${s.chain}→${b.chain} | Liq: $${(s.liquidityUsd / 1e6).toFixed(1)}M`
    );
  }

  // 4. Planning (if not watch-only)
  if (!watchOnly && lowRisk.length > 0) {
    console.log("\n📋 Planning...");
    // In paper mode, just log what we would do
    for (const opp of lowRisk.slice(0, 3)) {
      console.log(
        `\n  Would enter: ${opp.asset} | ${(opp.grossSpread * 100).toFixed(2)}% spread`
      );
      console.log(
        `    Supply ${(opp.supplyMarket.supplyApyWithRewards * 100).toFixed(2)}% on ${opp.supplyMarket.chain}`
      );
      console.log(
        `    Borrow ${(opp.borrowMarket.borrowApy * 100).toFixed(2)}% on ${opp.borrowMarket.chain}`
      );
      console.log(
        `    Liquidity: $${(opp.supplyMarket.liquidityUsd / 1e6).toFixed(1)}M | Util: ${(opp.supplyMarket.utilization * 100).toFixed(0)}%`
      );

      if (mode === "paper") {
        console.log("    📝 Paper trade — not executing");
      }
      // TODO: In live mode, call planEntry() and executor.execute()
    }
  }

  state.lastScan = Date.now();
  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  console.log(`\n⏱️  Cycle completed in ${elapsed}s`);
}

// Run
await runCycle();

if (!once) {
  const intervalMs = 5 * 60 * 1000;
  console.log(`\n🔄 Looping every ${intervalMs / 1000}s...`);
  setInterval(runCycle, intervalMs);
}
