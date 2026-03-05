/**
 * Watcher Service
 * 
 * Scans Morpho markets across chains, tracks portfolio balances,
 * and writes results to data/ for other services to consume.
 * 
 * Runs on configurable interval (default 5 min).
 */

import { fetchAllMarkets, findOpportunities } from "../../shared/adapters/morpho-rates.js";
import { fetchPortfolio, formatPortfolio } from "../../shared/adapters/portfolio.js";
import { CHAINS } from "../../shared/config.js";
import { writeData } from "../../shared/store.js";
import type { MorphoMarketRate, PortfolioState } from "../../shared/types.js";

const INTERVAL_MS = parseInt(process.env.WATCHER_INTERVAL_MS || String(5 * 60 * 1000));
const LOOP = !process.argv.includes("--once");

async function runScan() {
  const cycleStart = Date.now();
  console.log("═".repeat(60));
  console.log(`Watcher Scan — ${new Date().toISOString()}`);
  console.log("═".repeat(60));

  const targetChainIds = Object.values(CHAINS).map((c) => c.id);

  // 1. Fetch portfolio
  console.log("\n📊 Fetching portfolio...");
  let portfolio: PortfolioState | null = null;
  try {
    portfolio = await fetchPortfolio();
    console.log(formatPortfolio(portfolio));
    writeData("portfolio.json", portfolio);
    console.log("  → Written to data/portfolio.json");
  } catch (err: any) {
    console.error("  Portfolio fetch failed:", err.message);
  }

  // 2. Fetch Morpho markets
  console.log("🔍 Scanning Morpho markets...");
  let markets: MorphoMarketRate[] = [];
  try {
    markets = await fetchAllMarkets();
    const targetMarkets = markets.filter((m) => targetChainIds.includes(m.chainId));
    console.log(`  ${markets.length} total markets, ${targetMarkets.length} on target chains`);

    writeData("markets.json", {
      timestamp: Date.now(),
      totalMarkets: markets.length,
      targetMarkets: targetMarkets.length,
      markets: targetMarkets,
    });
    console.log("  → Written to data/markets.json");
  } catch (err: any) {
    console.error("  Market fetch failed:", err.message);
  }

  // 3. Find opportunities
  if (markets.length > 0) {
    const allOpps = findOpportunities(markets, {
      minSpreadPct: 0.5,
      targetChainIds,
    });

    const lowRiskOpps = findOpportunities(markets, {
      minSpreadPct: 1.0,
      targetChainIds,
      positiveborrowOnly: true,
      minSupplyTvl: 500_000,
    });

    console.log(`\n⚡ ${allOpps.length} opportunities | 🎯 ${lowRiskOpps.length} low-risk`);

    // Print top opportunities
    for (const opp of allOpps.slice(0, 5)) {
      const s = opp.supplyMarket;
      const tag = opp.rewardDependencyPct > 0.5 ? "💎" : opp.rewardDependencyPct > 0 ? "🔸" : "🟢";
      console.log(
        `  ${tag} ${opp.asset.padEnd(8)} ${(opp.grossSpread * 100).toFixed(2).padStart(6)}% | ` +
          `${s.chain}→${opp.borrowMarket.chain} | Liq: $${(s.liquidityUsd / 1e6).toFixed(1)}M`
      );
    }

    writeData("opportunities.json", {
      timestamp: Date.now(),
      all: allOpps,
      lowRisk: lowRiskOpps,
    });
    console.log("  → Written to data/opportunities.json");
  }

  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  console.log(`\n⏱️  Watcher cycle completed in ${elapsed}s`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("🔭 Citadel Watcher Service");
  console.log(`   Interval: ${INTERVAL_MS / 1000}s | Mode: ${LOOP ? "loop" : "once"}`);
  console.log("");

  await runScan();

  if (LOOP) {
    console.log(`\n🔄 Looping every ${INTERVAL_MS / 1000}s...`);
    setInterval(runScan, INTERVAL_MS);
  }
}

main().catch(console.error);
